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
from typing import Any, Dict, Generator
from unittest.mock import Mock, call

import pytest

from hookci.application import constants
from hookci.application.errors import ProjectAlreadyInitializedError
from hookci.application.events import (
    PipelineEnd,
    PipelineStart,
    StepEnd,
    StepStart,
)
from hookci.application.services import CiExecutionService, ProjectInitializationService
from hookci.domain.config import Configuration
from hookci.infrastructure.docker import IDockerService
from hookci.infrastructure.errors import ConfigurationParseError
from hookci.infrastructure.fs import IFileSystem, IGitService
from hookci.infrastructure.yaml_handler import IConfigurationHandler


@pytest.fixture
def mock_git_service() -> Mock:
    """Fixture for a mocked IGitService."""
    service = Mock(spec=IGitService)
    service.find_git_root.return_value = Path("/repo")
    return service


@pytest.fixture
def mock_fs() -> Mock:
    """Fixture for a mocked IFileSystem."""
    return Mock(spec=IFileSystem)


@pytest.fixture
def mock_config_handler() -> Mock:
    """Fixture for a mocked IConfigurationHandler."""
    return Mock(spec=IConfigurationHandler)


@pytest.fixture
def mock_docker_service() -> Mock:
    """Fixture for a mocked IDockerService."""
    mock = Mock(spec=IDockerService)

    # This mock will be used for successful runs
    def mock_run_command_success(
        *args: Any, **kwargs: Any
    ) -> Generator[str, None, int]:
        yield "log line 1"
        return 0  # Success exit code

    mock.run_command_in_container.side_effect = mock_run_command_success
    return mock


@pytest.fixture
def valid_config_dict() -> Dict[str, Any]:
    """Provides a valid configuration as a dictionary."""
    return {
        "version": "1.0",
        "log_level": "INFO",
        "docker": {"image": "test:latest"},
        "steps": [
            {"name": "Lint", "command": "ruff", "critical": True},
            {"name": "Test", "command": "pytest", "critical": True},
        ],
    }


def test_init_service_success(
    mock_git_service: Mock, mock_fs: Mock, mock_config_handler: Mock
) -> None:
    """
    Verify the initialization service correctly creates all necessary files,
    directories, and configures git hooks.
    """
    # Arrange: Project is not yet initialized
    mock_fs.file_exists.return_value = False
    service = ProjectInitializationService(
        mock_git_service, mock_fs, mock_config_handler
    )

    git_root = Path("/repo")
    base_dir = git_root / constants.BASE_DIR_NAME
    hooks_dir = base_dir / "hooks"
    config_path = base_dir / constants.CONFIG_FILENAME
    pre_commit_path = hooks_dir / "pre-commit"
    pre_push_path = hooks_dir / "pre-push"

    # Act
    result_path = service.run()

    # Assert
    assert result_path == config_path
    mock_git_service.find_git_root.assert_called_once()
    mock_fs.file_exists.assert_called_once_with(config_path)
    mock_fs.create_dir.assert_called_once_with(hooks_dir)

    mock_config_handler.write_config_data.assert_called_once()
    write_args = mock_config_handler.write_config_data.call_args.args
    assert write_args[0] == config_path
    assert isinstance(write_args[1], dict)
    assert write_args[1]["version"] == "1.0"

    expected_fs_calls = [
        call.write_file(pre_commit_path, service._PRE_COMMIT_SCRIPT),
        call.make_executable(pre_commit_path),
        call.write_file(pre_push_path, service._PRE_PUSH_SCRIPT),
        call.make_executable(pre_push_path),
    ]
    mock_fs.assert_has_calls(expected_fs_calls, any_order=True)

    mock_git_service.set_hooks_path.assert_called_once_with(hooks_dir)


def test_init_service_already_initialized(
    mock_git_service: Mock, mock_fs: Mock, mock_config_handler: Mock
) -> None:
    """
    Verify that ProjectAlreadyInitializedError is raised if the config file exists.
    """
    # Arrange: Project is already initialized
    mock_fs.file_exists.return_value = True
    service = ProjectInitializationService(
        mock_git_service, mock_fs, mock_config_handler
    )

    # Act & Assert
    with pytest.raises(ProjectAlreadyInitializedError):
        service.run()

    # Ensure no directories or files were written, and git was not configured
    mock_fs.create_dir.assert_not_called()
    mock_config_handler.write_config_data.assert_not_called()
    mock_fs.write_file.assert_not_called()
    mock_git_service.set_hooks_path.assert_not_called()


def test_ci_execution_service_success_yields_correct_events(
    mock_git_service: Mock,
    mock_config_handler: Mock,
    mock_docker_service: Mock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """
    Verify the CI service yields the correct sequence of events for a successful run.
    """
    # Arrange
    mock_config_handler.load_config_data.return_value = valid_config_dict
    config = Configuration.model_validate(valid_config_dict)
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )

    # Act
    events = list(service.run())

    # Assert by filtering events by type - this is more robust
    pipeline_starts = [e for e in events if isinstance(e, PipelineStart)]
    step_starts = [e for e in events if isinstance(e, StepStart)]
    step_ends = [e for e in events if isinstance(e, StepEnd)]
    pipeline_ends = [e for e in events if isinstance(e, PipelineEnd)]

    assert len(pipeline_starts) == 1
    assert pipeline_starts[0].total_steps == 2

    assert len(step_starts) == 2
    assert step_starts[0].step == config.steps[0]
    assert step_starts[1].step == config.steps[1]

    assert len(step_ends) == 2
    assert step_ends[0].status == "SUCCESS"
    assert step_ends[1].status == "SUCCESS"

    assert len(pipeline_ends) == 1
    assert pipeline_ends[0].status == "SUCCESS"

    assert mock_docker_service.run_command_in_container.call_count == 2


def test_ci_execution_service_critical_failure_yields_correct_events(
    mock_git_service: Mock,
    mock_config_handler: Mock,
    mock_docker_service: Mock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """
    Verify the CI service aborts and yields correct events on a critical failure.
    """
    # Arrange
    mock_config_handler.load_config_data.return_value = valid_config_dict
    config = Configuration.model_validate(valid_config_dict)

    # Mock the docker service to fail the first step
    def mock_run_command_fail(*args: Any, **kwargs: Any) -> Generator[str, None, int]:
        yield "critical step failed"
        return 1  # Failure exit code

    mock_docker_service.run_command_in_container.side_effect = mock_run_command_fail

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )

    # Act
    events = list(service.run())

    # Assert
    step_starts = [e for e in events if isinstance(e, StepStart)]
    step_ends = [e for e in events if isinstance(e, StepEnd)]
    pipeline_ends = [e for e in events if isinstance(e, PipelineEnd)]

    assert len(step_starts) == 1
    assert step_starts[0].step == config.steps[0]

    assert len(step_ends) == 1
    assert step_ends[0].status == "FAILURE"
    assert step_ends[0].step == config.steps[0]

    assert len(pipeline_ends) == 1
    assert pipeline_ends[0].status == "FAILURE"

    mock_docker_service.run_command_in_container.assert_called_once()


def test_ci_execution_service_invalid_config(
    mock_git_service: Mock, mock_config_handler: Mock, mock_docker_service: Mock
) -> None:
    """
    Verify that a ConfigurationParseError is raised for invalid config structure.
    """
    # Arrange
    invalid_config_data = {"version": "1.0", "steps": [{"name": "missing command"}]}
    mock_config_handler.load_config_data.return_value = invalid_config_data

    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )

    # Act & Assert
    with pytest.raises(
        ConfigurationParseError, match="Invalid configuration structure"
    ):
        # We need to consume the generator to trigger the exception
        list(service.run())
