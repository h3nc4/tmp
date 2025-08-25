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
from unittest.mock import Mock, call

import pytest
from hookci.application.errors import ProjectAlreadyInitializedError
from hookci.application.constants import (
    BASE_DIR_NAME,
    CONFIG_FILENAME,
)
from hookci.application.services import ProjectInitializationService
from hookci.domain.config import Configuration
from hookci.infrastructure.fs import IFileSystem, IGitService
from hookci.infrastructure.yaml_handler import YamlConfigurationHandler


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
    """Fixture for a mocked YamlConfigurationHandler."""
    return Mock(spec=YamlConfigurationHandler)


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
    base_dir = git_root / BASE_DIR_NAME
    hooks_dir = base_dir / service._HOOKS_DIR_NAME
    config_path = base_dir / CONFIG_FILENAME
    pre_commit_path = hooks_dir / service._PRE_COMMIT_FILENAME
    pre_push_path = hooks_dir / service._PRE_PUSH_FILENAME

    # Act
    result_path = service.run()

    # Assert
    assert result_path == config_path
    mock_git_service.find_git_root.assert_called_once()
    mock_fs.file_exists.assert_called_once_with(config_path)
    mock_fs.create_dir.assert_called_once_with(hooks_dir)

    mock_config_handler.write_config.assert_called_once()
    write_config_args = mock_config_handler.write_config.call_args
    assert write_config_args.args[0] == config_path
    assert isinstance(write_config_args.args[1], Configuration)

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
    mock_config_handler.write_config.assert_not_called()
    mock_fs.write_file.assert_not_called()
    mock_git_service.set_hooks_path.assert_not_called()
