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
from typing import Any, Dict, Generator, Tuple
from unittest.mock import Mock, PropertyMock, call

import pytest

from hookci.application import constants
from hookci.application.constants import LATEST_CONFIG_VERSION
from hookci.application.errors import (
    ConfigurationUpToDateError,
    ProjectAlreadyInitializedError,
)
from hookci.application.events import (
    LogLine,
    PipelineEnd,
    PipelineStart,
    StepStart,
)
from hookci.application.services import (
    CiExecutionService,
    MigrationService,
    ProjectInitializationService,
)
from hookci.domain.config import LogLevel
from hookci.infrastructure.docker import IDockerService, LogStream
from hookci.infrastructure.errors import ConfigurationParseError
from hookci.infrastructure.fs import IFileSystem, IGitService
from hookci.infrastructure.yaml_handler import IConfigurationHandler


@pytest.fixture
def mock_git_service() -> Mock:
    """Fixture for a mocked IGitService."""
    service = Mock(spec=IGitService)

    # Create the PropertyMock that we will use for assertions
    git_root_prop_mock = PropertyMock(return_value=Path("/repo"))

    # Attach the mock to the mock's class so it behaves like a property
    type(service).git_root = git_root_prop_mock

    # Also attach the PropertyMock *instance* to the service mock itself.
    # This allows tests to access the mock for assertions without triggering it.
    service.mock_git_root_prop = git_root_prop_mock

    service.get_current_branch.return_value = "main"
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

    def mock_run_command_success(
        *args: Any, **kwargs: Any
    ) -> Generator[Tuple[LogStream, str], None, int]:
        yield "stdout", "log line 1"
        return 0

    mock.run_command_in_container.side_effect = mock_run_command_success
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


def test_init_service_success(
    mock_git_service: Mock, mock_fs: Mock, mock_config_handler: Mock
) -> None:
    """
    Verify the initialization service correctly creates all necessary files.
    """
    mock_fs.file_exists.return_value = False
    service = ProjectInitializationService(
        mock_git_service, mock_fs, mock_config_handler
    )

    git_root = Path("/repo")
    base_dir = git_root / constants.BASE_DIR_NAME
    hooks_dir = base_dir / "hooks"
    config_path = base_dir / constants.CONFIG_FILENAME
    pre_commit_path = hooks_dir / "pre-commit"

    result_path = service.run()

    assert result_path == config_path
    # Assert that the property mock (retrieved from the instance) was called
    mock_git_service.mock_git_root_prop.assert_called_once()

    mock_fs.create_dir.assert_called_once_with(hooks_dir)
    mock_config_handler.write_config_data.assert_called_once()
    mock_fs.assert_has_calls(
        [
            call.write_file(pre_commit_path, service._PRE_COMMIT_SCRIPT),
            call.make_executable(pre_commit_path),
        ]
    )
    mock_git_service.set_hooks_path.assert_called_once_with(hooks_dir)


def test_init_service_already_initialized(
    mock_git_service: Mock, mock_fs: Mock, mock_config_handler: Mock
) -> None:
    """
    Verify ProjectAlreadyInitializedError is raised if the config file exists.
    """
    mock_fs.file_exists.return_value = True
    service = ProjectInitializationService(
        mock_git_service, mock_fs, mock_config_handler
    )

    with pytest.raises(ProjectAlreadyInitializedError):
        service.run()
    mock_fs.create_dir.assert_not_called()


def test_ci_manual_run_success(
    mock_git_service: Mock,
    mock_config_handler: Mock,
    mock_docker_service: Mock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """
    Verify a manual CI run (no hook_type) executes and yields correct events.
    """
    mock_config_handler.load_config_data.return_value = valid_config_dict
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )

    events = list(service.run(hook_type=None))

    pipeline_start_event = next(e for e in events if isinstance(e, PipelineStart))
    assert pipeline_start_event.log_level == LogLevel.INFO

    log_line_event = next(e for e in events if isinstance(e, LogLine))
    assert log_line_event.stream == "stdout"
    assert log_line_event.line == "log line 1"

    assert any(isinstance(e, StepStart) for e in events)
    assert any(isinstance(e, PipelineEnd) for e in events)
    mock_docker_service.run_command_in_container.assert_called_once()


def test_ci_hook_run_is_skipped_if_disabled(
    mock_git_service: Mock,
    mock_config_handler: Mock,
    mock_docker_service: Mock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """
    Verify that a hook-triggered run is skipped if disabled in the config.
    """
    valid_config_dict["hooks"]["pre_commit"] = False
    mock_config_handler.load_config_data.return_value = valid_config_dict
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )

    events = list(service.run(hook_type="pre-commit"))

    assert not events
    mock_docker_service.run_command_in_container.assert_not_called()


def test_ci_hook_run_is_skipped_by_branch_filter(
    mock_git_service: Mock,
    mock_config_handler: Mock,
    mock_docker_service: Mock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """
    Verify that a hook-triggered run is skipped if the branch doesn't match the filter.
    """
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
    mock_git_service: Mock,
    mock_config_handler: Mock,
    mock_docker_service: Mock,
    valid_config_dict: Dict[str, Any],
) -> None:
    """
    Verify that a hook-triggered run proceeds if the branch matches the filter.
    """
    valid_config_dict["filters"] = {"branches": "feature/.*"}
    mock_config_handler.load_config_data.return_value = valid_config_dict
    mock_git_service.get_current_branch.return_value = "feature/new-login"
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )

    events = list(service.run(hook_type="pre-commit"))

    assert any(isinstance(e, PipelineEnd) for e in events)
    mock_docker_service.run_command_in_container.assert_called_once()


def test_ci_execution_service_invalid_config(
    mock_git_service: Mock, mock_config_handler: Mock, mock_docker_service: Mock
) -> None:
    """
    Verify that a ConfigurationParseError is raised for invalid config structure.
    """
    invalid_config_data = {"version": "1.0", "steps": "not-a-list"}
    mock_config_handler.load_config_data.return_value = invalid_config_data
    service = CiExecutionService(
        mock_git_service, mock_config_handler, mock_docker_service
    )

    with pytest.raises(ConfigurationParseError):
        list(service.run(hook_type=None))


def test_migration_service_success_from_unversioned(
    mock_git_service: Mock,
    mock_config_handler: Mock,
) -> None:
    """
    Verify the migration service correctly transforms a legacy (unversioned) config.
    """
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
    assert written_data["steps"][1]["name"] == "Step 2"
    assert written_data["steps"][1]["command"] == "flake8"
    assert written_data["log_level"] == "INFO"


def test_migration_service_from_old_version_string(
    mock_git_service: Mock,
    mock_config_handler: Mock,
) -> None:
    """
    Verify the migration service correctly transforms a config with an old version string.
    """
    old_version_config = {
        "version": "0.1",
        "image": "python:3.8",
        "steps": ["pytest"],
    }
    mock_config_handler.load_config_data.return_value = old_version_config

    service = MigrationService(mock_git_service, mock_config_handler)
    message = service.run()

    assert "successfully migrated" in message
    mock_config_handler.write_config_data.assert_called_once()
    written_data = mock_config_handler.write_config_data.call_args[0][1]

    assert written_data["version"] == LATEST_CONFIG_VERSION
    assert written_data["docker"]["image"] == "python:3.8"
    assert len(written_data["steps"]) == 1
    assert written_data["steps"][0]["command"] == "pytest"


def test_migration_service_already_up_to_date(
    mock_git_service: Mock,
    mock_config_handler: Mock,
) -> None:
    """
    Verify ConfigurationUpToDateError is raised if config version is the latest.
    """
    up_to_date_config = {"version": LATEST_CONFIG_VERSION, "steps": []}
    mock_config_handler.load_config_data.return_value = up_to_date_config

    service = MigrationService(mock_git_service, mock_config_handler)

    with pytest.raises(ConfigurationUpToDateError):
        service.run()

    mock_config_handler.write_config_data.assert_not_called()


def test_migration_service_invalid_legacy_docker_config(
    mock_git_service: Mock,
    mock_config_handler: Mock,
) -> None:
    """
    Verify it fails if legacy docker config is invalid (e.g., both image and dockerfile).
    """
    legacy_config = {
        "image": "python:3.9",
        "dockerfile": "Dockerfile",
        "steps": [],
    }
    mock_config_handler.load_config_data.return_value = legacy_config

    service = MigrationService(mock_git_service, mock_config_handler)

    with pytest.raises(ConfigurationParseError, match="not both"):
        service.run()
