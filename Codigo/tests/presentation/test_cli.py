# Copyright (C) 2025 PUC Minas, Henrique Almeida, Gabriel Dolabela
# This file is part of HookCI.

# HookCI is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# HookCI is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.

# You should have received a copy of the GNU Affero General Public License
# along with HookCI.  If not, see <https://www.gnu.org/licenses/>.

"""
Tests for the presentation (CLI) layer.
"""
import subprocess
from pathlib import Path
from typing import Generator, cast
from unittest.mock import MagicMock, Mock, patch, call

import pytest
import typer
from pydantic import BaseModel
from rich.console import Console, Group
from rich.live import Live
from rich.syntax import Syntax
from typer.testing import CliRunner

from hookci.application.errors import (
    ApplicationError,
    ConfigurationUpToDateError,
    ProjectAlreadyInitializedError,
)
from hookci.application.events import (
    DebugShellStarting,
    EventStatus,
    ImageBuildEnd,
    ImageBuildProgress,
    ImageBuildStart,
    ImagePullEnd,
    ImagePullStart,
    LogLine,
    PipelineEnd,
    PipelineEvent,
    PipelineStart,
    StepEnd,
    StepStart,
)
from hookci.domain.config import LogLevel, Step
from hookci.infrastructure.errors import InfrastructureError
from hookci.presentation.cli import (
    DebugUI,
    PipelineUI,
    _handle_error,
    _open_interactive_shell,
    app,
    main,
)

runner = CliRunner()


@pytest.fixture
def mock_container() -> Generator[MagicMock, None, None]:
    """Fixture to mock the global DI container."""
    with patch("hookci.presentation.cli.container") as mock:
        yield mock


@pytest.fixture
def mock_logger() -> Generator[MagicMock, None, None]:
    """Fixture to mock the CLI logger."""
    with patch("hookci.presentation.cli.logger") as mock:
        yield mock


def test_version_callback() -> None:
    """Verify that --version flag prints the version and exits."""
    result = runner.invoke(app, ["--version"])
    assert result.exit_code == 0
    assert "HookCI version" in result.stdout


def test_init_success(mock_container: MagicMock) -> None:
    """Verify the 'init' command prints success messages on a successful run."""
    mock_container.project_init_service.run.return_value = Path(
        "/fake/repo/.hookci/hookci.yaml"
    )
    result = runner.invoke(app, ["init"])
    assert result.exit_code == 0
    assert "Success! HookCI has been initialized." in result.stdout
    assert "Configuration file created at:" in result.stdout
    mock_container.project_init_service.run.assert_called_once()


def test_init_failure_logs_error(
    mock_container: MagicMock, mock_logger: MagicMock
) -> None:
    """Verify 'init' command logs errors from the service and exits with code 1."""
    mock_container.project_init_service.run.side_effect = (
        ProjectAlreadyInitializedError("Already done")
    )
    result = runner.invoke(app, ["init"])
    assert result.exit_code == 1
    mock_logger.error.assert_called_once_with("Already done")


def test_migrate_success(mock_container: MagicMock) -> None:
    """Verify the 'migrate' command prints the success message."""
    mock_container.migration_service.run.return_value = "Migration complete"
    result = runner.invoke(app, ["migrate"])
    assert result.exit_code == 0
    assert "Migration complete" in result.stdout


def test_migrate_up_to_date_info(
    mock_container: MagicMock, mock_logger: MagicMock
) -> None:
    """Verify 'migrate' handles ConfigurationUpToDateError as an info message and exits 0."""
    mock_container.migration_service.run.side_effect = ConfigurationUpToDateError(
        "Already up-to-date"
    )
    result = runner.invoke(app, ["migrate"])
    assert result.exit_code == 0
    mock_logger.info.assert_any_call("Already up-to-date")


def test_migrate_unexpected_error(
    mock_container: MagicMock, mock_logger: MagicMock
) -> None:
    """Verify 'migrate' command handles and logs a generic, unexpected exception."""
    mock_container.migration_service.run.side_effect = ValueError(
        "Something unexpected broke"
    )
    result = runner.invoke(app, ["migrate"])
    assert result.exit_code == 1
    mock_logger.exception.assert_called_once_with(
        "An unexpected error occurred: Something unexpected broke"
    )


def test_run_success(mock_container: MagicMock) -> None:
    """Verify a successful 'run' exits with code 0."""

    def event_generator() -> Generator[PipelineEvent, None, None]:
        yield PipelineStart(total_steps=1, log_level=LogLevel.INFO)
        yield PipelineEnd(status="SUCCESS")

    mock_container.ci_execution_service.run.return_value = event_generator()
    with patch("hookci.presentation.cli.Live"):  # Mock Rich Live display
        result = runner.invoke(app, ["run"])

    assert result.exit_code == 0
    assert "Pipeline finished successfully!" in result.stdout


def test_run_failure(mock_container: MagicMock) -> None:
    """Verify a failed 'run' exits with code 1."""

    def event_generator() -> Generator[PipelineEvent, None, None]:
        yield PipelineStart(total_steps=1, log_level=LogLevel.INFO)
        yield PipelineEnd(status="FAILURE")

    mock_container.ci_execution_service.run.return_value = event_generator()
    with patch("hookci.presentation.cli.Live"):
        result = runner.invoke(app, ["run"])

    assert result.exit_code == 1
    assert "Pipeline failed." in result.stdout


def test_run_warning(mock_container: MagicMock) -> None:
    """Verify a 'run' with warnings exits with code 0."""

    def event_generator() -> Generator[PipelineEvent, None, None]:
        yield PipelineStart(total_steps=1, log_level=LogLevel.INFO)
        yield PipelineEnd(status="WARNING")

    mock_container.ci_execution_service.run.return_value = event_generator()
    with patch("hookci.presentation.cli.Live"):
        result = runner.invoke(app, ["run"])

    assert result.exit_code == 0
    assert "Pipeline finished with non-critical failures." in result.stdout


def test_run_skipped(mock_container: MagicMock, mock_logger: MagicMock) -> None:
    """Verify a skipped 'run' exits gracefully and logs an info message."""
    # service.run() returns an empty generator when the run is skipped.
    mock_container.ci_execution_service.run.return_value = iter([])

    result = runner.invoke(app, ["run"])

    assert result.exit_code == 0
    # Check that the service was called
    mock_container.ci_execution_service.run.assert_called_once()
    # Check that the correct info message was logged
    mock_logger.info.assert_called_once_with(
        "Pipeline run was skipped based on configuration filters."
    )


def test_run_unexpected_error(
    mock_container: MagicMock, mock_logger: MagicMock
) -> None:
    """Verify 'run' command handles and logs a generic, unexpected exception."""
    mock_container.ci_execution_service.run.side_effect = ValueError(
        "Something unexpected broke"
    )
    result = runner.invoke(app, ["run"])
    assert result.exit_code == 1
    mock_logger.exception.assert_called_once_with(
        "An unexpected error occurred: Something unexpected broke"
    )


def test_run_debug_mode(mock_container: MagicMock) -> None:
    """Verify that 'run --debug' uses the correct debug handler."""
    step = Step(name="Test", command="pytest")

    def event_generator() -> Generator[PipelineEvent, None, None]:
        yield PipelineStart(total_steps=1, log_level=LogLevel.DEBUG)
        yield StepStart(step=step)
        yield StepEnd(step=step, status="SUCCESS", exit_code=0)
        yield PipelineEnd(status="SUCCESS")

    mock_container.ci_execution_service.run.return_value = event_generator()
    result = runner.invoke(app, ["run", "--debug"])

    assert result.exit_code == 0
    assert "Pipeline Started" in result.stdout
    assert "Running Step: Test" in result.stdout


@patch("hookci.presentation.cli._open_interactive_shell")
def test_run_debug_mode_failure_calls_shell(
    mock_open_shell: Mock, mock_container: MagicMock
) -> None:
    """Verify a failed debug run calls the interactive shell helper."""
    step = Step(name="Test", command="pytest")

    def event_generator() -> Generator[PipelineEvent, None, None]:
        yield PipelineStart(total_steps=1, log_level=LogLevel.DEBUG)
        yield StepStart(step=step)
        yield DebugShellStarting(step=step, container_id="123")
        yield PipelineEnd(status="FAILURE")

    mock_container.ci_execution_service.run.return_value = event_generator()
    result = runner.invoke(app, ["run", "--debug"])

    assert result.exit_code == 1
    mock_open_shell.assert_called_once_with("123", step)


def test_unexpected_error_is_logged(
    mock_container: MagicMock, mock_logger: MagicMock
) -> None:
    """Verify that a generic exception is logged via logger.exception."""
    mock_container.project_init_service.run.side_effect = ValueError("Something broke")
    result = runner.invoke(app, ["init"])
    assert result.exit_code == 1
    mock_logger.exception.assert_called_once_with(
        "An unexpected error occurred: Something broke"
    )


def test_application_error_is_logged(
    mock_container: MagicMock, mock_logger: MagicMock
) -> None:
    """Verify ApplicationError is logged via logger.error."""
    mock_container.project_init_service.run.side_effect = ApplicationError("App error")
    result = runner.invoke(app, ["init"])
    assert result.exit_code == 1
    mock_logger.error.assert_called_once_with("App error")


def test_infrastructure_error_is_logged(
    mock_container: MagicMock, mock_logger: MagicMock
) -> None:
    """Verify InfrastructureError is logged via logger.error."""
    mock_container.project_init_service.run.side_effect = InfrastructureError(
        "Infra error"
    )
    result = runner.invoke(app, ["init"])
    assert result.exit_code == 1
    mock_logger.error.assert_called_once_with("Infra error")


def test_handle_error_unexpected(mock_logger: MagicMock) -> None:
    """Verify that a generic Exception is handled correctly."""
    with pytest.raises(typer.Exit) as exc_info:
        _handle_error(ValueError("Unexpected"))
    assert exc_info.value.exit_code == 1
    mock_logger.exception.assert_called_once_with(
        "An unexpected error occurred: Unexpected"
    )


@patch("hookci.presentation.cli.subprocess.run")
def test_open_interactive_shell_finds_bash(mock_run: Mock) -> None:
    """Verify the interactive shell successfully opens with bash."""
    mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=0)
    step = Step(name="test", command="cmd")
    _open_interactive_shell("container-123", step)
    mock_run.assert_called_once_with(
        ["docker", "exec", "-it", "container-123", "bash"], check=False
    )


@patch("hookci.presentation.cli.subprocess.run")
def test_open_interactive_shell_returns_on_non_special_exit_code(
    mock_run: Mock,
) -> None:
    """Verify the function returns if the shell exits with a non-special error code (e.g., 1)."""
    # Simulate a shell that is found but exits with an error
    mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=1)
    step = Step(name="test", command="cmd")
    _open_interactive_shell("container-123", step)

    # It should try 'bash' and then return immediately without trying other shells.
    mock_run.assert_called_once_with(
        ["docker", "exec", "-it", "container-123", "bash"], check=False
    )


@patch("hookci.presentation.cli.subprocess.run")
def test_open_interactive_shell_falls_back_to_sh(mock_run: Mock) -> None:
    """Verify fallback to 'ash' and then 'sh' if 'bash' is not found."""
    # Simulate 'not found' (exit code 127) for bash and ash
    mock_run.side_effect = [
        subprocess.CompletedProcess(args=[], returncode=127),
        subprocess.CompletedProcess(args=[], returncode=127),
        subprocess.CompletedProcess(args=[], returncode=0),
    ]
    step = Step(name="test", command="cmd")
    _open_interactive_shell("container-123", step)
    assert mock_run.call_count == 3
    assert mock_run.call_args_list[0].args[0][-1] == "bash"
    assert mock_run.call_args_list[1].args[0][-1] == "ash"
    assert mock_run.call_args_list[2].args[0][-1] == "sh"


@patch("hookci.presentation.cli.subprocess.run")
@patch("hookci.presentation.cli.logger")
def test_open_interactive_shell_no_shell_found(
    mock_logger: Mock, mock_run: Mock
) -> None:
    """Verify an error is logged if no valid shell is found."""
    mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=127)
    step = Step(name="test", command="cmd")
    _open_interactive_shell("container-123", step)
    mock_logger.error.assert_called_with(
        "Could not find a valid shell (bash, ash, sh) in the container."
    )


@patch("hookci.presentation.cli.subprocess.run")
@patch("hookci.presentation.cli.logger")
def test_open_interactive_shell_docker_not_found(
    mock_logger: Mock, mock_run: Mock
) -> None:
    """Verify an error is logged if the docker command is not found."""
    mock_run.side_effect = FileNotFoundError
    step = Step(name="test", command="cmd")
    _open_interactive_shell("container-123", step)
    mock_logger.error.assert_called_once_with(
        "`docker` command not found. Is Docker installed and in your PATH?"
    )


@patch("hookci.presentation.cli.subprocess.run")
@patch("hookci.presentation.cli.logger")
def test_open_interactive_shell_subprocess_fails(
    mock_logger: Mock, mock_run: Mock
) -> None:
    """Verify a generic exception during subprocess.run is logged for each attempted shell."""
    mock_run.side_effect = Exception("File not in PATH error")
    step = Step(name="test", command="cmd")
    _open_interactive_shell("container-123", step)

    # It should try all 3 shells, log an error for each, then log the final error.
    assert mock_run.call_count == 3
    assert mock_logger.error.call_count == 4

    expected_calls = [
        call("Failed to open interactive shell with 'bash': File not in PATH error"),
        call("Failed to open interactive shell with 'ash': File not in PATH error"),
        call("Failed to open interactive shell with 'sh': File not in PATH error"),
        call("Could not find a valid shell (bash, ash, sh) in the container."),
    ]
    # Use any_order=False if the order is guaranteed, True if it's not.
    # The loop order is guaranteed, so any_order=False is fine.
    # However, the final "Could not find" message comes after the loop.
    mock_logger.error.assert_has_calls(expected_calls, any_order=True)


@patch("hookci.presentation.cli.app")
def test_main_function_calls_app(mock_app: MagicMock) -> None:
    """Verify that the main() function calls the typer app."""
    main()
    mock_app.assert_called_once()


class TestDebugUI:
    """Tests for the DebugUI class."""

    def test_handle_event_ignores_unknown_event(self) -> None:
        """Verify that an unknown event type does not crash the handler."""

        class UnknownEvent(BaseModel):
            pass

        handler = DebugUI()
        # No exception should be raised
        handler.handle_event(cast(PipelineEvent, UnknownEvent()))

    @patch("hookci.presentation.cli.console.print")
    def test_handle_log_line_stderr(self, mock_print: MagicMock) -> None:
        """Verify LogLine with stderr is printed with the correct color."""
        handler = DebugUI()
        event = LogLine(line="error line  ", stream="stderr", step_name="test")
        handler.handle_event(event)
        # It should also strip the line
        mock_print.assert_called_once_with("  [red]error line[/]")

    @patch("hookci.presentation.cli.console.print")
    def test_handle_step_end_failure_and_warning(self, mock_print: MagicMock) -> None:
        """Verify StepEnd with FAILURE and WARNING statuses are printed correctly."""
        handler = DebugUI()
        step = Step(name="Test Step", command="fail")

        # Test FAILURE status
        failure_event = StepEnd(step=step, status="FAILURE", exit_code=1)
        handler.handle_event(failure_event)
        mock_print.assert_called_with(
            "[bold red]✖ Step 'Test Step' Failed (Status: FAILURE)[/]"
        )

        # Test WARNING status
        warning_event = StepEnd(step=step, status="WARNING", exit_code=1)
        handler.handle_event(warning_event)
        mock_print.assert_called_with(
            "[bold yellow]✖ Step 'Test Step' Failed (Status: WARNING)[/]"
        )

    @patch("hookci.presentation.cli.console.print")
    def test_debug_ui_handles_docker_events(self, mock_print: MagicMock) -> None:
        """Verify the DebugUI prints messages for Docker pull and build events."""
        handler = DebugUI()
        handler.handle_event(ImagePullStart(image_name="python:3.9"))
        assert "Pulling image" in mock_print.call_args[0][0]
        handler.handle_event(ImagePullEnd(status="SUCCESS"))
        assert "Image pulled successfully" in mock_print.call_args[0][0]

        handler.handle_event(
            ImageBuildStart(
                dockerfile_path="df", tag="t", total_steps=5
            )
        )
        assert "Building image" in mock_print.call_args[0][0]
        handler.handle_event(ImageBuildProgress(step=1, line="Step 1/5"))
        assert "Step 1/5" in mock_print.call_args[0][0]
        handler.handle_event(ImageBuildEnd(status="FAILURE"))
        assert "Image build failed" in mock_print.call_args[0][0]


class TestPipelineUI:
    """Tests for the PipelineUI class state management."""

    @pytest.fixture
    def ui(self) -> PipelineUI:
        return PipelineUI(Console())

    @pytest.fixture
    def live_mock(self) -> MagicMock:
        return MagicMock(spec=Live)

    def test_pipeline_start(self, ui: PipelineUI, live_mock: MagicMock) -> None:
        """Verify PipelineStart event sets up the UI state."""
        event = PipelineStart(total_steps=5, log_level=LogLevel.DEBUG)
        ui.handle_event(event, live_mock)
        assert ui.log_level == LogLevel.DEBUG
        assert ui.overall_progress.tasks[0].total == 5
        live_mock.update.assert_called_once()

    def test_handle_event_ignores_unknown_event(
        self, ui: PipelineUI, live_mock: MagicMock
    ) -> None:
        """Verify that an unknown event type does not crash the handler."""

        class UnknownEvent(BaseModel):
            pass

        ui.handle_event(cast(PipelineEvent, UnknownEvent()), live_mock)
        # The only call should be from the initial state
        live_mock.update.assert_not_called()

    @pytest.mark.parametrize("level", [LogLevel.INFO, LogLevel.DEBUG])
    def test_step_start(
        self, ui: PipelineUI, live_mock: MagicMock, level: LogLevel
    ) -> None:
        """Verify StepStart creates correct panels based on log level."""
        ui.handle_event(PipelineStart(total_steps=1, log_level=level), live_mock)
        step = Step(name="Lint", command="flake8")
        event = StepStart(step=step)
        ui.handle_event(event, live_mock)

        assert "Lint" in ui.step_tasks
        if level == LogLevel.INFO:
            assert ui.active_info_panel is not None
            assert not ui.debug_panels
        else:  # DEBUG
            assert ui.active_info_panel is None
            assert "Lint" in ui.debug_panels
        assert live_mock.update.call_count == 2

    @pytest.mark.parametrize("level", [LogLevel.INFO, LogLevel.DEBUG])
    def test_log_line_updates_panel(
        self, ui: PipelineUI, live_mock: MagicMock, level: LogLevel
    ) -> None:
        """Verify LogLine event updates the correct panel content."""
        ui.handle_event(PipelineStart(total_steps=1, log_level=level), live_mock)
        step = Step(name="Test", command="pytest")
        ui.handle_event(StepStart(step=step), live_mock)

        ui.handle_event(LogLine(line=".", stream="stdout", step_name="Test"), live_mock)

        panel = (
            ui.active_info_panel if level == LogLevel.INFO else ui.debug_panels["Test"]
        )
        assert panel is not None
        renderable = panel.renderable
        assert isinstance(renderable, Group)
        assert len(renderable.renderables) == 2
        assert isinstance(renderable.renderables[1], Syntax)

        # A second log line should replace the syntax object
        ui.handle_event(LogLine(line="F", stream="stdout", step_name="Test"), live_mock)
        assert len(renderable.renderables) == 2
        assert live_mock.update.call_count == 4

    @pytest.mark.parametrize(
        "status, color",
        [("SUCCESS", "green"), ("FAILURE", "red"), ("WARNING", "yellow")],
    )
    def test_step_end_updates(
        self,
        ui: PipelineUI,
        live_mock: MagicMock,
        status: EventStatus,
        color: str,
    ) -> None:
        """Verify StepEnd event updates progress descriptions and panel states."""
        ui.handle_event(
            PipelineStart(total_steps=1, log_level=LogLevel.DEBUG), live_mock
        )
        step = Step(name="Test", command="pytest")
        ui.handle_event(StepStart(step=step), live_mock)
        ui.handle_event(StepEnd(step=step, status=status, exit_code=0), live_mock)

        task = ui.steps_progress.tasks[0]
        assert color in str(task.description)
        assert task.completed == 1

        if status == "SUCCESS":
            assert ui.overall_progress.tasks[0].completed == 1
            assert not ui.error_panels
            assert "Test" in ui.debug_panels
        elif status == "FAILURE":
            assert ui.overall_progress.tasks[0].completed == 0
            assert len(ui.error_panels) == 1
            assert "Test" not in ui.debug_panels
        elif status == "WARNING":
            assert ui.overall_progress.tasks[0].completed == 0
            assert not ui.error_panels  # No error panel for warnings
            assert "Test" in ui.debug_panels  # Debug panel remains

    def test_finalize_step_ignores_missing_task_id(
        self, ui: PipelineUI, live_mock: MagicMock
    ) -> None:
        """Verify finalize_step doesn't crash if a task ID is not found."""
        step = Step(name="Untracked Step", command="echo")
        # No StepStart event, so step_tasks is empty
        ui.handle_event(StepEnd(step=step, status="SUCCESS", exit_code=0), live_mock)
        # Assert no exceptions were raised and progress wasn't updated
        assert ui.overall_progress.tasks[0].completed == 0
        live_mock.update.assert_called_once()  # Should still trigger a UI update

    @pytest.mark.parametrize(
        "status, phrase",
        [
            ("SUCCESS", "Pipeline Finished"),
            ("FAILURE", "Pipeline Failed"),
            ("WARNING", "Finished with Warnings"),
        ],
    )
    def test_pipeline_end(
        self,
        ui: PipelineUI,
        live_mock: MagicMock,
        status: EventStatus,
        phrase: str,
    ) -> None:
        """Verify PipelineEnd updates the overall progress description."""
        ui.handle_event(
            PipelineStart(total_steps=1, log_level=LogLevel.INFO), live_mock
        )
        ui.handle_event(PipelineEnd(status=status), live_mock)
        assert phrase in ui.overall_progress.tasks[0].description

    def test_ui_handles_complex_flow_with_all_panels(
        self, ui: PipelineUI, live_mock: MagicMock
    ) -> None:
        """Verify UI state through a flow that creates info, debug, and error panels."""
        # Start with debug level to create debug panels
        ui.handle_event(
            PipelineStart(total_steps=3, log_level=LogLevel.DEBUG), live_mock
        )

        # First step succeeds
        step1 = Step(name="SuccessStep", command="ok")
        ui.handle_event(StepStart(step=step1), live_mock)
        ui.handle_event(StepEnd(step=step1, status="SUCCESS", exit_code=0), live_mock)
        assert "SuccessStep" in ui.debug_panels
        assert not ui.error_panels

        # Second step fails critically
        step2 = Step(name="FailStep", command="fail")
        ui.handle_event(StepStart(step=step2), live_mock)
        ui.handle_event(StepEnd(step=step2, status="FAILURE", exit_code=1), live_mock)
        assert "FailStep" not in ui.debug_panels  # It should be removed
        assert len(ui.error_panels) == 1
        assert "FailStep" in str(ui.error_panels[0].title)

        # At this point, we have debug and error panels. Check the display group.
        group = ui._get_display_group()
        assert len(group.renderables) == 2 + 1 + 1  # Progs + debug_panel + error_panel

        # Now, let's test the info panel separately as it's exclusive of debug panels
        ui_info = PipelineUI(Console())
        ui_info.handle_event(
            PipelineStart(total_steps=1, log_level=LogLevel.INFO), live_mock
        )
        step3 = Step(name="InfoStep", command="info")
        ui_info.handle_event(StepStart(step=step3), live_mock)
        assert ui_info.active_info_panel is not None
        group = ui_info._get_display_group()
        assert len(group.renderables) == 2 + 1  # Progs + info_panel

    def test_ui_handles_image_pull(self, ui: PipelineUI, live_mock: MagicMock) -> None:
        """Verify UI correctly displays image pull progress."""
        ui.handle_event(ImagePullStart(image_name="test:latest"), live_mock)
        assert ui.docker_task is not None
        assert "Pulling" in ui.steps_progress.tasks[0].description

        ui.handle_event(ImagePullEnd(status="SUCCESS"), live_mock)
        assert "Pulled" in ui.steps_progress.tasks[0].description
        assert ui.steps_progress.tasks[0].completed == 1

    def test_ui_handles_image_build(self, ui: PipelineUI, live_mock: MagicMock) -> None:
        """Verify UI correctly displays image build progress."""
        ui.handle_event(
            ImageBuildStart(dockerfile_path="df", tag="t", total_steps=5),
            live_mock,
        )
        assert ui.docker_task is not None
        assert ui.steps_progress.tasks[0].total == 5

        ui.handle_event(ImageBuildProgress(step=3, line="Step 3/5..."), live_mock)
        assert ui.steps_progress.tasks[0].completed == 3

        ui.handle_event(ImageBuildEnd(status="FAILURE"), live_mock)
        assert "Failed" in ui.steps_progress.tasks[0].description


def test_run_debug_mode_with_single_event(mock_container: MagicMock) -> None:
    """Verify that 'run --debug' works correctly with a single event in the generator."""

    def single_event_generator() -> Generator[PipelineEvent, None, None]:
        # This generator yields one event and then finishes.
        yield PipelineEnd(status="SUCCESS")

    mock_container.ci_execution_service.run.return_value = single_event_generator()
    result = runner.invoke(app, ["run", "--debug"])

    assert result.exit_code == 0
    # The DebugUI for PipelineEnd just sets a status, it doesn't print.
    # The final status message is printed by the `run` function itself.
    assert "Pipeline finished successfully!" in result.stdout
