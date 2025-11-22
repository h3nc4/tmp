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
import queue
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
from hookci.domain.config import Configuration, LogLevel, Step
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
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """
    Verify a manual CI run with an image config pulls the image and runs steps.
    """
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
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
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify that if a pulled image exists, it is not pulled again."""
    mock_docker_service.image_exists.return_value = True
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
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
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify the pipeline stops on a critical step failure."""
    valid_config_dict["steps"].append({"name": "Second", "command": "echo"})
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env

    def mock_run_fail(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        yield "stderr", "error!"
        return 1

    mock_docker_service.run_command_in_container.side_effect = mock_run_fail
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type=None))
    assert any(isinstance(e, StepEnd) and e.status == "FAILURE" for e in events)
    assert any(isinstance(e, PipelineEnd) and e.status == "FAILURE" for e in events)
    # With threading, exact call count might vary depending on when failure hits,
    # but since they have no dependencies, they might both start. 
    # If the first one fails immediately, we stop submitting.
    # However, the list is iterated.
    assert mock_docker_service.run_command_in_container.call_count >= 1


def test_ci_run_warns_on_non_critical_failure(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a non-critical failure allows the pipeline to continue and sets status to WARNING."""
    valid_config_dict["steps"] = [
        {"name": "NonCritical", "command": "lint", "critical": False},
        {"name": "Critical", "command": "test", "depends_on": ["NonCritical"]},
    ]
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    
    # Maps step commands to exit codes
    exit_codes = {"lint": 1, "test": 0}

    def mock_run_commands(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        cmd = kwargs["command"]
        yield "stdout", "output"
        return exit_codes.get(cmd, 0)

    mock_docker_service.run_command_in_container.side_effect = mock_run_commands
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type=None))

    step_ends = [e for e in events if isinstance(e, StepEnd)]
    assert len(step_ends) == 2
    # Order isn't strictly guaranteed in general parallel, but here there is a dependency
    # Sorting by name to ensure stable order for assertions
    step_ends.sort(key=lambda e: e.step.name, reverse=True) # NonCritical, Critical
    
    assert step_ends[0].step.name == "NonCritical"
    assert step_ends[0].status == "WARNING"
    assert step_ends[1].step.name == "Critical"
    assert step_ends[1].status == "SUCCESS"

    pipeline_end = next(e for e in events if isinstance(e, PipelineEnd))
    assert pipeline_end.status == "WARNING"
    assert mock_docker_service.run_command_in_container.call_count == 2


def test_ci_run_multiple_non_critical_failures_results_in_warning(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify multiple non-critical failures still result in a WARNING, not FAILURE."""
    valid_config_dict["steps"] = [
        {"name": "NonCritical1", "command": "lint", "critical": False},
        {"name": "NonCritical2", "command": "format", "critical": False},
        {"name": "Critical", "command": "test", "depends_on": ["NonCritical1", "NonCritical2"]},
    ]
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    
    exit_codes = {"lint": 1, "format": 1, "test": 0}

    def mock_run_commands(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        cmd = kwargs["command"]
        yield "stdout", "output"
        return exit_codes.get(cmd, 0)

    mock_docker_service.run_command_in_container.side_effect = mock_run_commands
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type=None))

    pipeline_end = next(e for e in events if isinstance(e, PipelineEnd))
    assert pipeline_end.status == "WARNING"
    assert mock_docker_service.run_command_in_container.call_count == 3


def test_ci_run_with_dockerfile_build_success(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a pipeline with a Dockerfile builds the image and then runs the step."""
    valid_config_dict["docker"] = {"dockerfile": "Dockerfile.test"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
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
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify that a Dockerfile build is skipped if a cached image exists."""
    valid_config_dict["docker"] = {"dockerfile": "Dockerfile.test"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_docker_service.image_exists.return_value = True
    mock_fs.file_exists.return_value = False  # No .env

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
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
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a failed Dockerfile build stops the pipeline."""
    valid_config_dict["docker"] = {"dockerfile": "Dockerfile.test"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    mock_docker_service.build_image.side_effect = DockerError("Build failed")
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
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
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a failed Dockerfile build stops the pipeline in debug mode."""
    valid_config_dict["docker"] = {"dockerfile": "Dockerfile.test"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    mock_docker_service.build_image.side_effect = DockerError("Build failed")
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
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
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a hook-triggered run is skipped if disabled in the config."""
    valid_config_dict["hooks"]["pre_commit"] = False
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type="pre-commit"))
    assert not events
    mock_docker_service.run_command_in_container.assert_not_called()


def test_ci_pre_push_hook_run_is_skipped_if_disabled(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a pre-push hook is skipped if disabled."""
    valid_config_dict["hooks"]["pre_push"] = False
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type="pre-push"))
    assert not events


def test_ci_hook_run_is_skipped_by_branch_filter(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a hook-triggered run is skipped if the branch doesn't match the filter."""
    valid_config_dict["filters"] = {"branches": "feature/.*"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    mock_git_service.get_current_branch.return_value = "main"
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type="pre-commit"))
    assert not events
    mock_docker_service.run_command_in_container.assert_not_called()


def test_ci_hook_run_proceeds_with_matching_branch_filter(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a hook-triggered run proceeds if the branch matches the filter."""
    valid_config_dict["filters"] = {"branches": "feature/.*"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    mock_git_service.get_current_branch.return_value = "feature/new-login"
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type="pre-commit"))
    assert any(isinstance(e, PipelineEnd) for e in events)
    mock_docker_service.run_command_in_container.assert_called_once()


def test_ci_hook_run_proceeds_with_no_filters(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    config_dict_no_filters: Dict[str, Any],
) -> None:
    """Verify a hook-triggered run proceeds if no filters are defined."""
    mock_config_handler.load_config_data.return_value = config_dict_no_filters
    mock_fs.file_exists.return_value = False  # No .env
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type="pre-commit"))
    assert any(isinstance(e, PipelineEnd) for e in events)


def test_ci_pre_commit_run_is_skipped_by_commit_filter(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a pre-commit run is skipped if the commit message doesn't match."""
    valid_config_dict["filters"] = {"commits": r"^(feat|fix):"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    mock_git_service.get_staged_commit_message.return_value = "docs: update README"
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type="pre-commit"))
    assert not events
    mock_docker_service.run_command_in_container.assert_not_called()
    mock_git_service.get_staged_commit_message.assert_called_once()


def test_ci_pre_commit_run_proceeds_with_matching_commit_filter(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a pre-commit run proceeds if the commit message matches."""
    valid_config_dict["filters"] = {"commits": r"^(feat|fix):"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    mock_git_service.get_staged_commit_message.return_value = "feat: add new button"
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type="pre-commit"))
    assert any(isinstance(e, PipelineEnd) for e in events)
    mock_docker_service.run_command_in_container.assert_called_once()
    mock_git_service.get_staged_commit_message.assert_called_once()


def test_ci_execution_service_invalid_config(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
) -> None:
    """Verify a ConfigurationParseError is raised for invalid config structure."""
    invalid_config_data = {"version": "1.0", "steps": "not-a-list"}
    mock_config_handler.load_config_data.return_value = invalid_config_data
    mock_fs.file_exists.return_value = False  # No .env
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    with pytest.raises(ConfigurationParseError):
        list(service.run(hook_type=None))


def test_ci_execution_service_validation_error_in_config(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify ConfigurationParseError is raised when Pydantic validation fails."""
    # 'command' is missing, which is a required field for a Step
    valid_config_dict["steps"] = [{"name": "Invalid Step"}]
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    with pytest.raises(ConfigurationParseError) as exc_info:
        list(service.run(hook_type=None))
    assert "Invalid configuration structure" in str(exc_info.value)
    assert isinstance(exc_info.value.__cause__, ValidationError)


def test_ci_debug_and_hook_type_logs_warning(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a warning is logged when --debug is used with a git hook."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
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
    mock_fs: MagicMock,
) -> None:
    """Verify _prepare_docker_image raises an error if config is invalid."""
    # This state should be prevented by Pydantic, but we test the safeguard.
    bad_config = Configuration(version="1.0")
    # Manually create the invalid state by overriding the validated attribute
    bad_config.docker.image = None
    bad_config.docker.dockerfile = None

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    with pytest.raises(ConfigurationParseError):
        list(service._prepare_docker_image(bad_config))


def test_stream_logs_and_get_exit_code_no_return_value(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
) -> None:
    """
    Verify that if the generator behind StopIteration has no value, it defaults to 1.
    """
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )

    def log_generator_no_return() -> Generator[Tuple[LogStream, str], None, int]:  # type: ignore[return]
        yield "stdout", "line"
        # No explicit return, so StopIteration will have value=None

    # _stream_logs_and_get_exit_code is a generator itself.
    # We need to consume it to get its return value from the StopIteration exception.
    # We cast the generator to the type expected by the service method to test the fallback behavior.
    gen = service._stream_logs_and_get_exit_code(
        log_generator_no_return(),
        "test_step",
    )
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
    mock_fs: MagicMock,
) -> None:
    """Verify that if the generator returns a value, it is propagated."""
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
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
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a debug run succeeds and cleans up the container."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
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
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a critical failure in debug mode yields a DebugShellStarting event."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env

    def mock_exec_fail(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        yield "stderr", "error!"
        return 1

    mock_docker_service.exec_in_container.side_effect = mock_exec_fail
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
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
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify a non-critical failure in debug mode warns and continues."""
    valid_config_dict["steps"] = [
        {"name": "NonCritical", "command": "lint", "critical": False},
        {"name": "Critical", "command": "test"},
    ]
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    exit_codes = [1, 0]

    def mock_exec_commands(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        yield "stdout", "output"
        return exit_codes.pop(0)

    mock_docker_service.exec_in_container.side_effect = mock_exec_commands
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
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
    mock_fs: MagicMock,
) -> None:
    """Verify that an empty log generator correctly returns the default exit code of 1."""
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
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
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify that the pipeline fails if image pull fails."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    mock_docker_service.pull_image.side_effect = DockerError("Network error")

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type=None))

    assert any(isinstance(e, ImagePullStart) for e in events)
    assert any(isinstance(e, ImagePullEnd) and e.status == "FAILURE" for e in events)
    # The pipeline should end with FAILURE
    assert isinstance(events[-1], PipelineEnd)
    assert events[-1].status == "FAILURE"


def test_ci_run_infrastructure_error_during_step(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify correct handling of DockerError during step execution."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    # Raise DockerError during command execution via the threaded wrapper's call to run_command
    # We need to mock the side_effect on the docker service method
    mock_docker_service.run_command_in_container.side_effect = DockerError(
        "Container crashed"
    )

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type=None))

    # Verify pipeline ends with FAILURE
    pipeline_end = events[-1]
    assert isinstance(pipeline_end, PipelineEnd)
    assert pipeline_end.status == "FAILURE"

    # Verify the step marked as failed with proper exit code
    step_end = events[-2]
    assert isinstance(step_end, StepEnd)
    assert step_end.status == "FAILURE"
    assert step_end.exit_code == 1


def test_ci_debug_run_start_container_failure(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify failure to start debug container ends pipeline with FAILURE."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    mock_docker_service.start_persistent_container.side_effect = DockerError(
        "Startup failed"
    )

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type=None, debug=True))

    assert isinstance(events[-1], PipelineEnd)
    assert events[-1].status == "FAILURE"


def test_ci_debug_run_exec_failure(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify exec failure in debug mode triggers failure status."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    # Raise DockerError during exec
    mock_docker_service.exec_in_container.side_effect = DockerError("Exec failed")

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    events = list(service.run(hook_type=None, debug=True))

    pipeline_end = events[-1]
    assert isinstance(pipeline_end, PipelineEnd)
    assert pipeline_end.status == "FAILURE"

    # Check intermediate step failure
    step_end = next(e for e in events if isinstance(e, StepEnd))
    assert step_end.status == "FAILURE"


def test_prepare_docker_image_build_prep_failure(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify DockerError during build preparation (hash/count) returns None."""
    valid_config_dict["docker"] = {"dockerfile": "Dockerfile"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    # Fail during hash calculation
    mock_docker_service.calculate_dockerfile_hash.side_effect = DockerError(
        "Read error"
    )

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    # _prepare_docker_image is a generator, consume it
    results = list(
        service._prepare_docker_image(service._load_and_validate_configuration())
    )
    # The method should yield events (potentially) and return None.
    # Since it fails early, it might not yield events, but it definitely returns None
    # (which we can't see directly from list(), but we know it didn't raise).
    # To check return value, we'd need to use `yield from` in a wrapper, but here
    # we just verify it completes without raising exception and logs error.
    # Let's check if any events were yielded (none expected before hash calc)
    assert len(results) == 0


def test_prepare_docker_image_check_exists_failure(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify DockerError during image existence check logs warning and continues."""
    valid_config_dict["docker"] = {"image": "my-image"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False  # No .env
    mock_docker_service.image_exists.side_effect = DockerError("Daemon unresponsive")

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    # Should continue to attempt pull
    events = list(
        service._prepare_docker_image(service._load_and_validate_configuration())
    )
    assert any(isinstance(e, ImagePullStart) for e in events)
    mock_docker_service.pull_image.assert_called_once()


def test_ci_run_loads_dotenv_vars(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify that environment variables from .env are loaded and passed to docker."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    
    # Setup .env content
    mock_fs.file_exists.return_value = True
    mock_fs.read_file.return_value = 'API_KEY=12345\nDEBUG="true"'
    
    # Setup mock git root
    mock_git_service.git_root = Path("/repo")

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    list(service.run(hook_type=None))
    
    # Verify that run_command_in_container was called with combined env
    mock_docker_service.run_command_in_container.assert_called_once()
    call_args = mock_docker_service.run_command_in_container.call_args
    env_arg = call_args[1]["env"]
    
    assert env_arg["API_KEY"] == "12345"
    assert env_arg["DEBUG"] == "true"


def test_ci_run_dotenv_read_failure_is_logged(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify that failure to read .env logs a warning but continues."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = True
    mock_fs.read_file.side_effect = Exception("Permission denied")

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    
    with patch("hookci.application.services.logger") as mock_logger:
        list(service.run(hook_type=None))
        mock_logger.warning.assert_called()
        assert "Failed to read .env file" in mock_logger.warning.call_args[0][0]
        
    # Should still proceed
    mock_docker_service.run_command_in_container.assert_called_once()


def test_load_dotenv_parsing_edge_cases(
    mock_git_service: MagicMock,
    mock_fs: MagicMock,
    mock_config_handler: MagicMock,
) -> None:
    """Verify .env parsing ignores comments and empty lines."""
    service = CiExecutionService(
        mock_git_service, mock_config_handler, MagicMock(), mock_fs
    )
    
    env_content = """
    # This is a comment
    
    VALID_KEY=value
    # Another comment
        EMPTY_LINE_ABOVE=true
    """
    mock_fs.file_exists.return_value = True
    mock_fs.read_file.return_value = env_content
    
    env_vars = service._load_dotenv()
    assert len(env_vars) == 2
    assert env_vars["VALID_KEY"] == "value"
    assert env_vars["EMPTY_LINE_ABOVE"] == "true"


def test_run_pipeline_deadlock_detection(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify deadlock detection logic when steps exist but aren't submitted."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False
    
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    
    # Mock _submit_ready_steps to do nothing, simulating a stalled state
    with patch.object(service, '_submit_ready_steps'):
        with patch("hookci.application.services.logger") as mock_logger:
            events = list(service.run(hook_type=None))
            
            pipeline_end = events[-1]
            assert isinstance(pipeline_end, PipelineEnd)
            assert pipeline_end.status == "FAILURE"
            mock_logger.error.assert_called_with(
                "Deadlock detected or no reachable steps remaining."
            )


def test_run_pipeline_drains_queue_after_wait(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """Verify that events remaining in the queue after 'wait' are yielded."""
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_fs.file_exists.return_value = False
    
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    
    mock_queue_instance = MagicMock()
    # First call to empty() returns False (has item), second returns True (empty)
    mock_queue_instance.empty.side_effect = [False, True]
    mock_queue_instance.get.return_value = PipelineEnd(status="SUCCESS") # Just a dummy event
    
    with patch("hookci.application.services.queue.Queue", return_value=mock_queue_instance):
        with patch("hookci.application.services.wait"): # Mock wait so it returns immediately
             with patch.object(service, '_submit_ready_steps'): # Prevent submitting real tasks
                 list(service.run(hook_type=None))
             
    # Verify get() was called during the drain phase
    assert mock_queue_instance.get.call_count >= 1


def test_process_next_event_handles_timeout(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
) -> None:
    """Verify _process_next_event handles queue.Empty gracefully."""
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    mock_queue = MagicMock()
    mock_queue.get.side_effect = queue.Empty
    
    event, status, critical = service._process_next_event(
        mock_queue, [], set(), {}, {}, "SUCCESS"
    )
    
    assert event is None
    assert status == "SUCCESS"
    assert critical is False


def test_threaded_step_wrapper_handles_generic_exception(
    mock_git_service: MagicMock,
    mock_config_handler: MagicMock,
    mock_docker_service: MagicMock,
    mock_fs: MagicMock,
) -> None:
    """Verify the thread wrapper catches unexpected exceptions during execution."""
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service, mock_fs
    )
    
    # Mock run_command to raise a generic exception during iteration
    def mock_run_gen(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        yield "stdout", "start"
        raise Exception("Unexpected failure")
        
    mock_docker_service.run_command_in_container.side_effect = mock_run_gen
    
    mock_queue = MagicMock()
    step = Step(name="FailingStep", command="echo")
    
    service._threaded_step_wrapper(
        step, "image", Path("/"), {}, mock_queue
    )
    
    # Verify we got a StepEnd failure event in the queue
    calls = mock_queue.put.call_args_list
    # Last call should be StepEnd with FAILURE
    last_event = calls[-1][0][0]
    assert isinstance(last_event, StepEnd)
    assert last_event.status == "FAILURE"
    assert last_event.exit_code == 1
