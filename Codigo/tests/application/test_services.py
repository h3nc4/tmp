#!/usr/bin/env python3
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
from unittest.mock import Mock

import pytest
from hookci.application.errors import ProjectAlreadyInitializedError
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
    Verify that the initialization service correctly creates the config file
    in a new project.
    """
    # Arrange: Project is not yet initialized
    mock_fs.file_exists.return_value = False
    service = ProjectInitializationService(
        mock_git_service, mock_fs, mock_config_handler
    )

    # Act
    result_path = service.run()

    # Assert
    expected_config_path = Path("/repo") / "hookci.yaml"
    assert result_path == expected_config_path

    mock_git_service.find_git_root.assert_called_once()
    mock_fs.file_exists.assert_called_once_with(expected_config_path)

    # Verify that write_config was called with a Configuration object
    assert mock_config_handler.write_config.call_count == 1
    call_args = mock_config_handler.write_config.call_args
    assert call_args[0][0] == expected_config_path
    assert isinstance(call_args[0][1], Configuration)


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

    # Ensure no config file was written
    mock_config_handler.write_config.assert_not_called()
