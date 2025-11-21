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
Tests for application services.
"""
from pathlib import Path
from typing import Any, Dict, Generator, Tuple, cast
from unittest.mock import MagicMock, PropertyMock, call, create_autospec, patch

import pytest
from pydantic import ValidationError

from hookci.application import constants
from hookci.application.constants import LATEST_CONFIG_VERSION
from hookci.application.errors import (
    ConfigurationUpToDateError,
    ProjectAlreadyInitializedError,
)
from hookci.application.events import (
    DebugShellStarting,
    ImageBuildEnd,
    ImageBuildStart,
    ImagePullEnd,
    ImagePullStart,
    LogStream,
    PipelineEnd,
    PipelineStart,
    StepEnd,
)
from hookci.application.services import (
    CiExecutionService,
    MigrationService,
    ProjectInitService,
)
from hookci.domain.config import Configuration, LogLevel
from hookci.infrastructure.docker import IDockerService
from hookci.infrastructure.errors import ConfigurationParseError, DockerError
from hookci.infrastructure.fs import IFileSystem, IScmService
from hookci.infrastructure.yaml_handler import IConfigHandler


@pytest.fixture
def mock_git_service() -> MagicMock:
    """Fixture for a mocked IScmService."""
    service = cast(MagicMock, create_autospec(IScmService, instance=True))
    git_root_prop_mock = PropertyMock(return_value=Path("/repo"))
    type(service).git_root = git_root_prop_mock
    service.get_current_branch.return_value = "main"
    service.get_staged_commit_message.return_value = "feat: some change"
    return service


@pytest.fixture
def mock_fs() -> MagicMock:
    """Fixture for a mocked IFileSystem."""
    return cast(MagicMock, create_autospec(IFileSystem, instance=True))


@pytest.fixture
def mock_config_handler() -> MagicMock:
    """Fixture for a mocked IConfigHandler."""
    return cast(MagicMock, create_autospec(IConfigHandler, instance=True))


@pytest.fixture
def mock_docker_service() -> MagicMock:
    """Fixture for a mocked IDockerService."""
    mock = cast(MagicMock, create_autospec(IDockerService, instance=True))

    def mock_run_command_success(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        yield "stdout", "log line 1"
        return 0

    def mock_build_image_success(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[int, str], None, None]:
        yield 1, "Build step 1"
        yield 2, "Successfully built"

    def mock_pull_image_success(
        *args: Any, **kwargs: Any
    ) -> Generator[None, None, None]:
        yield

    mock.run_command_in_container.side_effect = mock_run_command_success
    mock.exec_in_container.side_effect = mock_run_command_success
    mock.build_image.side_effect = mock_build_image_success
    mock.pull_image.side_effect = mock_pull_image_success
    mock.start_persistent_container.return_value = "container-123"
    mock.image_exists.return_value = False
    mock.calculate_dockerfile_hash.return_value = "hash123"
    mock.count_dockerfile_steps.return_value = 5
    return mock


@pytest.fixture
def valid_config_dict() -> Dict[str, Any]:
    """Provides a valid configuration as a dictionary."""
    return {
        "version": "1.0",
        "log_level": "INFO",
        "docker": {"image": "test:latest"},
        "hooks": {"pre_commit": True, "pre_push": True},
        "steps": [{"name": "Test", "command": "pytest"}],
    }


@pytest.fixture
def config_dict_no_filters(valid_config_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Provides a valid configuration without a 'filters' section."""
    valid_config_dict.pop("filters", None)
    return valid_config_dict


def test_init_service_success(
    mock_git_service: MagicMock, mock_fs: MagicMock, mock_config_handler: MagicMock
) -> None:
    """
    Verify the initialization service correctly creates all necessary files.
    """
    mock_fs.file_exists.return_value = False
    service = ProjectInitService(mock_git_service, mock_fs, mock_config_handler)
    git_root = Path("/repo")
    base_dir = git_root / constants.BASE_DIR_NAME
    hooks_dir = base_dir / "hooks"
    config_path = base_dir / constants.CONFIG_FILENAME
    pre_commit_path = hooks_dir / "pre-commit"
    pre_push_path = hooks_dir / "pre-push"

    result_path = service.run()

    assert result_path == config_path
    mock_fs.create_dir.assert_called_once_with(hooks_dir)
    mock_config_handler.write_config_data.assert_called_once()
    mock_fs.assert_has_calls(
        [
            call.write_file(pre_commit_path, service._PRE_COMMIT_SCRIPT),
            call.make_executable(pre_commit_path),
            call.write_file(pre_push_path, service._PRE_PUSH_SCRIPT),
            call.make_executable(pre_push_path),
        ]
    )
    mock_git_service.set_hooks_path.assert_called_once_with(hooks_dir)


def test_init_service_already_initialized(
    mock_git_service: MagicMock, mock_fs: MagicMock, mock_config_handler: MagicMock
) -> None:
    """
    Verify ProjectAlreadyInitializedError is raised if the config file exists.
    """
    mock_fs.file_exists.return_value = True
    service = ProjectInitService(mock_git_service, mock_fs, mock_config_handler)
    with pytest.raises(ProjectAlreadyInitializedError):
        service.run()
    mock_fs.create_dir.assert_not_called()


def test_ci_manual_run_success_with_image_pull(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """
    Verify a manual CI run with an image config pulls the image and runs steps.
    """
    mock_config_handler.load_config_data.return_value = valid_config_dict
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None))
    assert isinstance(events[0], PipelineStart)
    assert events[0].log_level == LogLevel.INFO
    assert any(isinstance(e, ImagePullStart) for e in events)
    assert any(isinstance(e, ImagePullEnd) for e in events)
    assert isinstance(events[-1], PipelineEnd)
    assert events[-1].status == "SUCCESS"
    mock_docker_service.pull_image.assert_called_once_with("test:latest")
    mock_docker_service.run_command_in_container.assert_called_once()


def test_ci_run_uses_cached_pulled_image(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify that if a pulled image exists, it is not pulled again."""
    mock_docker_service.image_exists.return_value = True
    mock_config_handler.load_config_data.return_value = valid_config_dict
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None))
    assert not any(isinstance(e, ImagePullStart) for e in events)
    mock_docker_service.image_exists.assert_called_once_with("test:latest")
    mock_docker_service.pull_image.assert_not_called()
    mock_docker_service.run_command_in_container.assert_called_once()


def test_ci_run_stops_on_critical_failure(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify the pipeline stops on a critical step failure."""
    valid_config_dict["steps"].append({"name": "Second", "command": "echo"})
    mock_config_handler.load_config_data.return_value = valid_config_dict

    def mock_run_fail(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        yield "stderr", "error!"
        return 1

    mock_docker_service.run_command_in_container.side_effect = mock_run_fail
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None))
    assert any(isinstance(e, StepEnd) and e.status == "FAILURE" for e in events)
    assert any(isinstance(e, PipelineEnd) and e.status == "FAILURE" for e in events)
    mock_docker_service.run_command_in_container.assert_called_once()


def test_ci_run_warns_on_non_critical_failure(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a non-critical failure allows the pipeline to continue and sets status to WARNING."""
    valid_config_dict["steps"] = [
        {"name": "NonCritical", "command": "lint", "critical": False},
        {"name": "Critical", "command": "test"},
    ]
    mock_config_handler.load_config_data.return_value = valid_config_dict
    exit_codes = [1, 0]

    def mock_run_commands(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        yield "stdout", "output"
        return exit_codes.pop(0)

    mock_docker_service.run_command_in_container.side_effect = mock_run_commands
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None))

    step_ends = [e for e in events if isinstance(e, StepEnd)]
    assert len(step_ends) == 2
    assert step_ends[0].status == "WARNING"
    assert step_ends[1].status == "SUCCESS"

    pipeline_end = next(e for e in events if isinstance(e, PipelineEnd))
    assert pipeline_end.status == "WARNING"
    assert mock_docker_service.run_command_in_container.call_count == 2


def test_ci_run_multiple_non_critical_failures_results_in_warning(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify multiple non-critical failures still result in a WARNING, not FAILURE."""
    valid_config_dict["steps"] = [
        {"name": "NonCritical1", "command": "lint", "critical": False},
        {"name": "NonCritical2", "command": "format", "critical": False},
        {"name": "Critical", "command": "test"},
    ]
    mock_config_handler.load_config_data.return_value = valid_config_dict
    # First two fail, last one succeeds
    exit_codes = [1, 1, 0]

    def mock_run_commands(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        yield "stdout", "output"
        return exit_codes.pop(0)

    mock_docker_service.run_command_in_container.side_effect = mock_run_commands
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None))

    pipeline_end = next(e for e in events if isinstance(e, PipelineEnd))
    assert pipeline_end.status == "WARNING"
    assert mock_docker_service.run_command_in_container.call_count == 3


def test_ci_run_with_dockerfile_build_success(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a pipeline with a Dockerfile builds the image and then runs the step."""
    valid_config_dict["docker"] = {"dockerfile": "Dockerfile.test"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None))

    assert any(isinstance(e, ImageBuildStart) for e in events)
    assert any(isinstance(e, ImageBuildEnd) and e.status == "SUCCESS" for e in events)
    mock_docker_service.build_image.assert_called_once()
    mock_docker_service.run_command_in_container.assert_called_once_with(
        image="hookci/repo:hash123",
        command="pytest",
        workdir=mock_git_service.git_root,
        env={},
    )


def test_ci_run_uses_cached_dockerfile_image(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify that a Dockerfile build is skipped if a cached image exists."""
    valid_config_dict["docker"] = {"dockerfile": "Dockerfile.test"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_docker_service.image_exists.return_value = True

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None))

    assert not any(isinstance(e, ImageBuildStart) for e in events)
    mock_docker_service.calculate_dockerfile_hash.assert_called_once()
    mock_docker_service.image_exists.assert_called_once_with("hookci/repo:hash123")
    mock_docker_service.build_image.assert_not_called()
    mock_docker_service.run_command_in_container.assert_called_once_with(
        image="hookci/repo:hash123",
        command="pytest",
        workdir=mock_git_service.git_root,
        env={},
    )


def test_ci_run_with_dockerfile_build_failure(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a failed Dockerfile build stops the pipeline."""
    valid_config_dict["docker"] = {"dockerfile": "Dockerfile.test"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_docker_service.build_image.side_effect = DockerError("Build failed")
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None))
    assert any(isinstance(e, ImageBuildStart) for e in events)
    assert any(isinstance(e, ImageBuildEnd) and e.status == "FAILURE" for e in events)
    assert any(isinstance(e, PipelineEnd) and e.status == "FAILURE" for e in events)
    mock_docker_service.build_image.assert_called_once()
    mock_docker_service.run_command_in_container.assert_not_called()


def test_ci_debug_run_build_failure(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a failed Dockerfile build stops the pipeline in debug mode."""
    valid_config_dict["docker"] = {"dockerfile": "Dockerfile.test"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_docker_service.build_image.side_effect = DockerError("Build failed")
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None, debug=True))
    assert any(isinstance(e, ImageBuildStart) for e in events)
    assert any(isinstance(e, ImageBuildEnd) and e.status == "FAILURE" for e in events)
    assert any(isinstance(e, PipelineEnd) and e.status == "FAILURE" for e in events)
    mock_docker_service.build_image.assert_called_once()
    # Ensure no container operations were attempted
    mock_docker_service.start_persistent_container.assert_not_called()


def test_ci_hook_run_is_skipped_if_disabled(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a hook-triggered run is skipped if disabled in the config."""
    valid_config_dict["hooks"]["pre_commit"] = False
    mock_config_handler.load_config_data.return_value = valid_config_dict
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type="pre-commit"))
    assert not events
    mock_docker_service.run_command_in_container.assert_not_called()


def test_ci_pre_push_hook_run_is_skipped_if_disabled(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a pre-push hook is skipped if disabled."""
    valid_config_dict["hooks"]["pre_push"] = False
    mock_config_handler.load_config_data.return_value = valid_config_dict
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type="pre-push"))
    assert not events


def test_ci_hook_run_is_skipped_by_branch_filter(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a hook-triggered run is skipped if the branch doesn't match the filter."""
    valid_config_dict["filters"] = {"branches": "feature/.*"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_git_service.get_current_branch.return_value = "main"
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type="pre-commit"))
    assert not events
    mock_docker_service.run_command_in_container.assert_not_called()


def test_ci_hook_run_proceeds_with_matching_branch_filter(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a hook-triggered run proceeds if the branch matches the filter."""
    valid_config_dict["filters"] = {"branches": "feature/.*"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_git_service.get_current_branch.return_value = "feature/new-login"
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type="pre-commit"))
    assert any(isinstance(e, PipelineEnd) for e in events)
    mock_docker_service.run_command_in_container.assert_called_once()


def test_ci_hook_run_proceeds_with_no_filters(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    config_dict_no_filters: Dict[str, Any],
) -> None:
    """Verify a hook-triggered run proceeds if no filters are defined."""
    mock_config_handler.load_config_data.return_value = config_dict_no_filters
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type="pre-commit"))
    assert any(isinstance(e, PipelineEnd) for e in events)


def test_ci_pre_commit_run_is_skipped_by_commit_filter(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a pre-commit run is skipped if the commit message doesn't match."""
    valid_config_dict["filters"] = {"commits": r"^(feat|fix):"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_git_service.get_staged_commit_message.return_value = "docs: update README"
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type="pre-commit"))
    assert not events
    mock_docker_service.run_command_in_container.assert_not_called()
    mock_git_service.get_staged_commit_message.assert_called_once()


def test_ci_pre_commit_run_proceeds_with_matching_commit_filter(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a pre-commit run proceeds if the commit message matches."""
    valid_config_dict["filters"] = {"commits": r"^(feat|fix):"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_git_service.get_staged_commit_message.return_value = "feat: add new button"
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type="pre-commit"))
    assert any(isinstance(e, PipelineEnd) for e in events)
    mock_docker_service.run_command_in_container.assert_called_once()
    mock_git_service.get_staged_commit_message.assert_called_once()


def test_ci_execution_service_invalid_config(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
) -> None:
    """Verify a ConfigurationParseError is raised for invalid config structure."""
    invalid_config_data = {"version": "1.0", "steps": "not-a-list"}
    mock_config_handler.load_config_data.return_value = invalid_config_data
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    with pytest.raises(ConfigurationParseError):
        list(service.run(hook_type=None))


def test_ci_execution_service_validation_error_in_config(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify ConfigurationParseError is raised when Pydantic validation fails."""
    # 'command' is missing, which is a required field for a Step
    valid_config_dict["steps"] = [{"name": "Invalid Step"}]
    mock_config_handler.load_config_data.return_value = valid_config_dict
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    with pytest.raises(ConfigurationParseError) as exc_info:
        list(service.run(hook_type=None))
    assert "Invalid configuration structure" in str(exc_info.value)
    assert isinstance(exc_info.value.__cause__, ValidationError)


def test_ci_debug_and_hook_type_logs_warning(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a warning is logged when --debug is used with a git hook."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    with patch("hookci.application.services.logger") as mock_logger:
        list(service.run(hook_type="pre-commit", debug=True))
        mock_logger.warning.assert_called_once_with(
            "Debug mode is enabled, but it is not supported for git hook runs. "
            "The pipeline will run in standard mode."
        )


def test_prepare_docker_image_raises_for_no_image_or_dockerfile(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
) -> None:
    """Verify _prepare_docker_image raises an error if config is invalid."""
    # This state should be prevented by Pydantic, but we test the safeguard.
    bad_config = Configuration(version="1.0")
    # Manually create the invalid state by overriding the validated attribute
    bad_config.docker.image = None
    bad_config.docker.dockerfile = None

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    with pytest.raises(ConfigurationParseError):
        list(service._prepare_docker_image(bad_config))


def test_stream_logs_and_get_exit_code_no_return_value(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
) -> None:
    """
    Verify that if the generator behind StopIteration has no value, it defaults to 1.
    """
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )

    def log_generator_no_return() -> Generator[Tuple[LogStream, str], None, int]:  # type: ignore[return]
        yield "stdout", "line"
        # No explicit return, so StopIteration will have value=None

    gen = service._stream_logs_and_get_exit_code(log_generator_no_return(), "test_step")
    exit_code = -1
    try:
        while True:
            next(gen)
    except StopIteration as e:
        exit_code = e.value

    assert exit_code == 1


def test_stream_logs_and_get_exit_code_with_return_value(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
) -> None:
    """Verify that if the generator returns a value, it is propagated."""
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )

    def log_generator_with_return() -> Generator[Tuple[LogStream, str], None, int]:
        yield "stdout", "line"
        return 123  # Explicit return value

    gen = service._stream_logs_and_get_exit_code(
        log_generator_with_return(), "test_step"
    )
    exit_code = -1
    try:
        while True:
            next(gen)  # Consume the generator
    except StopIteration as e:
        exit_code = e.value

    assert exit_code == 123


def test_ci_debug_run_success(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a debug run succeeds and cleans up the container."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None, debug=True))
    assert any(isinstance(e, PipelineEnd) and e.status == "SUCCESS" for e in events)
    mock_docker_service.start_persistent_container.assert_called_once()
    mock_docker_service.exec_in_container.assert_called_once()
    mock_docker_service.stop_and_remove_container.assert_called_once_with(
        "container-123"
    )
    assert not any(isinstance(e, DebugShellStarting) for e in events)


def test_ci_debug_run_critical_failure_triggers_debug_shell(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a critical failure in debug mode yields a DebugShellStarting event."""
    mock_config_handler.load_config_data.return_value = valid_config_dict

    def mock_exec_fail(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        yield "stderr", "error!"
        return 1

    mock_docker_service.exec_in_container.side_effect = mock_exec_fail
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None, debug=True))

    assert any(isinstance(e, DebugShellStarting) for e in events)
    assert any(isinstance(e, PipelineEnd) and e.status == "FAILURE" for e in events)
    mock_docker_service.start_persistent_container.assert_called_once()
    mock_docker_service.exec_in_container.assert_called_once()
    mock_docker_service.stop_and_remove_container.assert_called_once_with(
        "container-123"
    )


def test_ci_debug_run_warns_on_non_critical_failure(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a non-critical failure in debug mode warns and continues."""
    valid_config_dict["steps"] = [
        {"name": "NonCritical", "command": "lint", "critical": False},
        {"name": "Critical", "command": "test"},
    ]
    mock_config_handler.load_config_data.return_value = valid_config_dict
    exit_codes = [1, 0]

    def mock_exec_commands(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        yield "stdout", "output"
        return exit_codes.pop(0)

    mock_docker_service.exec_in_container.side_effect = mock_exec_commands
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None, debug=True))

    step_ends = [e for e in events if isinstance(e, StepEnd)]
    assert len(step_ends) == 2
    assert step_ends[0].status == "WARNING"
    assert step_ends[1].status == "SUCCESS"

    pipeline_end = next(e for e in events if isinstance(e, PipelineEnd))
    assert pipeline_end.status == "WARNING"

    # Verify debug mode behavior
    mock_docker_service.start_persistent_container.assert_called_once()
    assert mock_docker_service.exec_in_container.call_count == 2
    mock_docker_service.stop_and_remove_container.assert_called_once_with(
        "container-123"
    )
    assert not any(isinstance(e, DebugShellStarting) for e in events)


def test_migration_service_success_from_unversioned(
    mock_git_service: MagicMock, mock_config_handler: MagicMock
) -> None:
    """Verify the migration service correctly transforms a legacy (unversioned) config."""
    legacy_config = {
        "image": "python:3.9",
        "steps": ["pytest", "flake8"],
    }
    mock_config_handler.load_config_data.return_value = legacy_config
    service = MigrationService(mock_git_service, mock_config_handler)
    message = service.run()
    assert "successfully migrated" in message
    mock_config_handler.write_config_data.assert_called_once()
    written_data = mock_config_handler.write_config_data.call_args[0][1]
    assert written_data["version"] == LATEST_CONFIG_VERSION
    assert written_data["docker"]["image"] == "python:3.9"
    assert written_data["docker"].get("dockerfile") is None
    assert len(written_data["steps"]) == 2
    assert written_data["steps"][0]["name"] == "Step 1"
    assert written_data["steps"][0]["command"] == "pytest"


def test_migration_service_from_old_version_string(
    mock_git_service: MagicMock, mock_config_handler: MagicMock
) -> None:
    """Verify migration from a config with an old version string."""
    old_version_config = {
        "version": "0.1",
        "image": "python:3.8",
        "steps": ["pytest"],
    }
    mock_config_handler.load_config_data.return_value = old_version_config
    service = MigrationService(mock_git_service, mock_config_handler)
    message = service.run()
    assert "successfully migrated" in message
    written_data = mock_config_handler.write_config_data.call_args[0][1]
    assert written_data["version"] == LATEST_CONFIG_VERSION
    assert written_data["docker"]["image"] == "python:3.8"


def test_migration_service_already_up_to_date(
    mock_git_service: MagicMock, mock_config_handler: MagicMock
) -> None:
    """Verify ConfigurationUpToDateError is raised if config version is the latest."""
    up_to_date_config = {"version": LATEST_CONFIG_VERSION, "steps": []}
    mock_config_handler.load_config_data.return_value = up_to_date_config
    service = MigrationService(mock_git_service, mock_config_handler)
    with pytest.raises(ConfigurationUpToDateError):
        service.run()
    mock_config_handler.write_config_data.assert_not_called()


def test_migration_service_invalid_legacy_docker_config(
    mock_git_service: MagicMock, mock_config_handler: MagicMock
) -> None:
    """Verify it fails if legacy docker config is invalid."""
    legacy_config = {
        "image": "python:3.9",
        "dockerfile": "Dockerfile",
        "steps": [],
    }
    mock_config_handler.load_config_data.return_value = legacy_config
    service = MigrationService(mock_git_service, mock_config_handler)
    with pytest.raises(ConfigurationParseError, match="not both"):
        service.run()


def test_migration_service_parses_new_format_steps_in_legacy_config(
    mock_git_service: MagicMock, mock_config_handler: MagicMock
) -> None:
    """
    Verify migration handles a legacy file that already contains new-style steps.
    """
    legacy_config_with_new_steps = {"steps": [{"name": "Test", "command": "pytest"}]}
    mock_config_handler.load_config_data.return_value = legacy_config_with_new_steps
    service = MigrationService(mock_git_service, mock_config_handler)
    service.run()
    written_data = mock_config_handler.write_config_data.call_args[0][1]
    assert written_data["steps"][0]["name"] == "Test"


def test_migration_service_raises_on_invalid_new_format_steps(
    mock_git_service: MagicMock, mock_config_handler: MagicMock
) -> None:
    """
    Verify migration fails if steps in a legacy file are invalid new-style steps.
    """
    legacy_config_with_bad_steps = {
        "steps": [{"name": "Test", "cmd": "pytest"}]  # 'cmd' is invalid
    }
    mock_config_handler.load_config_data.return_value = legacy_config_with_bad_steps
    service = MigrationService(mock_git_service, mock_config_handler)
    with pytest.raises(ConfigurationParseError) as exc_info:
        service.run()
    assert "Could not parse 'steps' during migration" in str(exc_info.value)
    assert isinstance(exc_info.value.__cause__, ValidationError)


def test_stream_logs_and_get_exit_code_for_empty_generator(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
) -> None:
    """Verify that an empty log generator correctly returns the default exit code of 1."""
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )

    def empty_log_generator() -> Generator[Tuple[LogStream, str], None, None]:
        if False:
            yield "stdout", "unreachable"
        # This generator implicitly returns None.

    # _stream_logs_and_get_exit_code is a generator itself.
    # We need to consume it to get its return value from the StopIteration exception.
    # We cast the generator to the type expected by the service method to test the fallback behavior.
    gen = service._stream_logs_and_get_exit_code(
        cast(Generator[Tuple[LogStream, str], None, int], empty_log_generator()),
        "test_step",
    )
    exit_code = -1
    try:
        while True:
            next(gen)  # This will raise StopIteration immediately as the gen is empty
    except StopIteration as e:
        exit_code = e.value

    # The inner generator's StopIteration has `value=None`.
    # The outer generator catches this, and its logic dictates that if `e.value`
    # is None, the exit code defaults to 1.
    assert exit_code == 1


def test_ci_run_image_pull_failure(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify that the pipeline fails if image pull fails."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_docker_service.pull_image.side_effect = DockerError("Network error")

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )
    events = list(service.run(hook_type=None))

    assert any(isinstance(e, ImagePullStart) for e in events)
    assert any(isinstance(e, ImagePullEnd) and e.status == "FAILURE" for e in events)
    # The pipeline should end with FAILURE
    assert isinstance(events[-1], PipelineEnd)
    assert events[-1].status == "FAILURE"
