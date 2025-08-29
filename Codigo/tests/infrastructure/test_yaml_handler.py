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
Tests for the YAML configuration handler.
"""
from pathlib import Path
from typing import Any, Dict, Tuple
from unittest.mock import Mock

import pytest
import yaml

from hookci.infrastructure.errors import (
    ConfigurationNotFoundError,
    ConfigurationParseError,
)
from hookci.infrastructure.fs import IFileSystem
from hookci.infrastructure.yaml_handler import YamlConfigurationHandler


@pytest.fixture
def handler_with_mock_fs() -> Tuple[YamlConfigurationHandler, Mock]:
    """Fixture for YamlConfigurationHandler with a mocked IFileSystem."""
    mock_fs = Mock(spec=IFileSystem)
    handler = YamlConfigurationHandler(fs=mock_fs)
    return handler, mock_fs


def test_write_config_data_serializes_correctly(
    handler_with_mock_fs: Tuple[YamlConfigurationHandler, Mock],
) -> None:
    """
    Verify that a dictionary is serialized to the correct YAML format.
    """
    handler, mock_fs = handler_with_mock_fs
    config_data: Dict[str, Any] = {
        "version": "1.0",
        "log_level": "DEBUG",
        "docker": {"dockerfile": "Dockerfile.dev"},
        "steps": [{"name": "Build", "command": "make build"}],
    }
    config_path = Path("/tmp/hookci.yaml")
    handler.write_config_data(config_path, config_data)

    mock_fs.write_file.assert_called_once()
    call_args = mock_fs.write_file.call_args
    written_path, written_content = call_args[0]
    assert written_path == config_path
    data = yaml.safe_load(written_content)
    assert data == config_data


def test_load_config_data_success(
    handler_with_mock_fs: Tuple[YamlConfigurationHandler, Mock],
) -> None:
    """Verify that a valid YAML file is correctly parsed into a dictionary."""
    handler, mock_fs = handler_with_mock_fs
    yaml_content = "version: '1.1'\nlog_level: DEBUG\n"
    config_path = Path("/repo/.hookci/hookci.yaml")
    mock_fs.file_exists.return_value = True
    mock_fs.read_file.return_value = yaml_content

    data = handler.load_config_data(config_path)

    mock_fs.file_exists.assert_called_once_with(config_path)
    mock_fs.read_file.assert_called_once_with(config_path)
    assert data["version"] == "1.1"


def test_load_config_data_not_found(
    handler_with_mock_fs: Tuple[YamlConfigurationHandler, Mock],
) -> None:
    """Verify ConfigurationNotFoundError is raised if the file doesn't exist."""
    handler, mock_fs = handler_with_mock_fs
    config_path = Path("/nonexistent/hookci.yaml")
    mock_fs.file_exists.return_value = False

    with pytest.raises(ConfigurationNotFoundError):
        handler.load_config_data(config_path)


def test_load_config_data_bad_yaml(
    handler_with_mock_fs: Tuple[YamlConfigurationHandler, Mock],
) -> None:
    """Verify ConfigurationParseError is raised for malformed YAML."""
    handler, mock_fs = handler_with_mock_fs
    yaml_content = "version: 1.0\n  bad-indent:"
    config_path = Path("/repo/hookci.yaml")
    mock_fs.file_exists.return_value = True
    mock_fs.read_file.return_value = yaml_content

    with pytest.raises(ConfigurationParseError, match="Error parsing YAML"):
        handler.load_config_data(config_path)
