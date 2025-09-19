# tests/presentation/test_cli.py
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
Tests for the command-line interface (presentation layer).
"""
import logging
import subprocess
from pathlib import Path
from typing import Generator
from unittest.mock import Mock, call, patch

import pytest
from _pytest.logging import LogCaptureFixture
from typer.testing import CliRunner

from hookci.application.events import (
    DebugShellStarting,
    LogLine,
    PipelineEnd,
    PipelineEvent,
    PipelineStart,
    StepEnd,
    StepStart,
)
from hookci.application.services import (
    CiExecutionService,
    ProjectInitializationService,
)
from hookci.containers import container
from hookci.domain.config import LogLevel, Step
from hookci.infrastructure.errors import NotInGitRepositoryError
from hookci.presentation.cli import app

runner = CliRunner()


@pytest.fixture
def mock_init_service(monkeypatch: pytest.MonkeyPatch) -> Mock:
    """Mocks the ProjectInitializationService in the container."""
    mock = Mock(spec=ProjectInitializationService)
    monkeypatch.setattr(container, "project_init_service", mock, raising=False)
    return mock


@pytest.fixture
def mock_ci_service(monkeypatch: pytest.MonkeyPatch) -> Mock:
    """Mocks the CiExecutionService in the container."""
    mock = Mock(spec=CiExecutionService)
    monkeypatch.setattr(container, "ci_execution_service", mock, raising=False)
    return mock


def test_cli_no_args_shows_help() -> None:
    """Verify that running the app with no arguments shows the help message."""
    result = runner.invoke(app, [])
    assert "Usage:" in result.stdout
    assert "HookCI: A tool for running Continuous Integration locally" in result.stdout
    assert "init" in result.stdout


def test_init_success(mock_init_service: Mock, caplog: LogCaptureFixture) -> None:
    """Test the 'init' command on a successful run."""
    config_path = Path("/path/to/repo/.hookci/hookci.yaml")
    mock_init_service.run.return_value = config_path

    with caplog.at_level(logging.INFO):
        result = runner.invoke(app, ["init"])

    assert result.exit_code == 0
    assert "Initializing HookCI..." in caplog.text
    assert "Success! HookCI has been initialized." in result.stdout
    mock_init_service.run.assert_called_once()


def test_init_not_in_git_repo(
    mock_init_service: Mock, caplog: LogCaptureFixture
) -> None:
    """Test the 'init' command when not inside a Git repository."""
    mock_init_service.run.side_effect = NotInGitRepositoryError("Not a repo")

    with caplog.at_level(logging.ERROR):
        result = runner.invoke(app, ["init"])

    assert result.exit_code == 1
    assert "Not a repo" in caplog.text


def test_run_success(mock_ci_service: Mock) -> None:
    """Test the 'run' command on a successful pipeline execution."""
    step = Step(name="Test", command="pytest")

    def event_generator() -> Generator[PipelineEvent, None, None]:
        yield PipelineStart(total_steps=1, log_level=LogLevel.INFO)
        yield StepStart(step=step)
        yield LogLine(line="running tests...", stream="stdout", step_name=step.name)
        yield StepEnd(step=step, status="SUCCESS", exit_code=0)
        yield PipelineEnd(status="SUCCESS")

    mock_ci_service.run.return_value = event_generator()

    # In a non-interactive runner, we mainly check exit code and final message
    # as capturing rich's live display is complex and brittle.
    # Use a backend that doesn't rely on a real terminal for sizing.
    result = runner.invoke(app, ["run"], env={"TERM": "dumb", "COLUMNS": "120"})
    assert result.exit_code == 0
    assert "Pipeline finished successfully!" in result.stdout
    mock_ci_service.run.assert_called_once()


def test_run_failure(mock_ci_service: Mock) -> None:
    """Test the 'run' command when the pipeline fails."""
    step = Step(name="Test", command="pytest")

    def event_generator() -> Generator[PipelineEvent, None, None]:
        yield PipelineStart(total_steps=1, log_level=LogLevel.INFO)
        yield StepStart(step=step)
        yield LogLine(line="test failed!", stream="stderr", step_name=step.name)
        yield StepEnd(step=step, status="FAILURE", exit_code=1)
        yield PipelineEnd(status="FAILURE")

    mock_ci_service.run.return_value = event_generator()

    result = runner.invoke(app, ["run"], env={"TERM": "dumb", "COLUMNS": "120"})

    assert result.exit_code == 1
    assert "Pipeline failed." in result.stdout


def test_run_unexpected_error(mock_ci_service: Mock, caplog: LogCaptureFixture) -> None:
    """Test 'run' handles unexpected exceptions."""
    mock_ci_service.run.side_effect = ValueError("Kaboom")

    with caplog.at_level(logging.ERROR):
        result = runner.invoke(app, ["run"])

    assert result.exit_code == 1
    assert "An unexpected error occurred: Kaboom" in caplog.text


@patch("subprocess.run")
def test_run_debug_mode_opens_shell_on_failure(
    mock_subprocess: Mock, mock_ci_service: Mock
) -> None:
    """Verify the debug shell is opened on failure in debug mode."""
    step = Step(name="Failing Step", command="false")

    def event_generator() -> Generator[PipelineEvent, None, None]:
        yield PipelineStart(total_steps=1, log_level=LogLevel.DEBUG)
        yield StepStart(step=step)
        yield StepEnd(step=step, status="FAILURE", exit_code=1)
        yield DebugShellStarting(step=step, container_id="debug_id_123")
        yield PipelineEnd(status="FAILURE")

    mock_ci_service.run.return_value = event_generator()

    # Mock subprocess to simulate finding 'bash'
    mock_subprocess.return_value = subprocess.CompletedProcess(args=[], returncode=0)

    result = runner.invoke(app, ["run", "--debug"])

    assert result.exit_code == 1
    assert "Opening debug shell" in result.stdout
    mock_ci_service.run.assert_called_once_with(hook_type=None, debug=True)
    mock_subprocess.assert_called_once_with(
        ["docker", "exec", "-it", "debug_id_123", "bash"], check=False
    )


@patch("subprocess.run")
def test_debug_shell_fallback_logic(
    mock_subprocess: Mock, mock_ci_service: Mock, caplog: LogCaptureFixture
) -> None:
    """Verify the shell fallback logic (bash -> ash -> sh)."""
    step = Step(name="Failing Step", command="false")

    def event_generator() -> Generator[PipelineEvent, None, None]:
        yield DebugShellStarting(step=step, container_id="debug_id_123")
        yield PipelineEnd(status="FAILURE")

    mock_ci_service.run.return_value = event_generator()

    # Simulate bash not found (rc=127), ash not found, but sh is found
    mock_subprocess.side_effect = [
        subprocess.CompletedProcess(args=[], returncode=127),  # bash fails
        subprocess.CompletedProcess(args=[], returncode=127),  # ash fails
        subprocess.CompletedProcess(args=[], returncode=0),  # sh succeeds
    ]

    runner.invoke(app, ["run", "--debug"])

    expected_calls = [
        call(["docker", "exec", "-it", "debug_id_123", "bash"], check=False),
        call(["docker", "exec", "-it", "debug_id_123", "ash"], check=False),
        call(["docker", "exec", "-it", "debug_id_123", "sh"], check=False),
    ]
    mock_subprocess.assert_has_calls(expected_calls)
    assert "Could not find a valid shell" not in caplog.text


@patch("subprocess.run")
def test_debug_shell_no_shell_found(
    mock_subprocess: Mock, mock_ci_service: Mock, caplog: LogCaptureFixture
) -> None:
    """Verify an error is logged if no valid shell is found."""
    step = Step(name="Failing Step", command="false")

    def event_generator() -> Generator[PipelineEvent, None, None]:
        yield DebugShellStarting(step=step, container_id="debug_id_123")
        yield PipelineEnd(status="FAILURE")

    mock_ci_service.run.return_value = event_generator()
    mock_subprocess.return_value = subprocess.CompletedProcess(args=[], returncode=127)

    with caplog.at_level(logging.ERROR):
        runner.invoke(app, ["run", "--debug"])

    assert (
        "Could not find a valid shell (bash, ash, sh) in the container." in caplog.text
    )
