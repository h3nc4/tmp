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
from typing import Tuple
from unittest.mock import Mock

import pytest
import yaml

from hookci.domain.config import Configuration, Docker, Filters, Hooks, Step
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


def test_write_config_serializes_correctly(
    handler_with_mock_fs: Tuple[YamlConfigurationHandler, Mock],
) -> None:
    """
    Verify that a Configuration object is serialized to the correct YAML format.
    """
    handler, mock_fs = handler_with_mock_fs
    config = Configuration(
        version="1.0",
        log_level="DEBUG",
        docker=Docker(dockerfile="Dockerfile.dev", image=None),
        hooks=Hooks(pre_commit=True, pre_push=False),
        filters=Filters(branches="feature/.*", commits=None),
        steps=[
            Step(
                name="Build",
                command="make build",
                critical=True,
                env={"BUILD_TARGET": "production"},
            )
        ],
    )

    config_path = Path("/tmp/hookci.yaml")
    handler.write_config(config_path, config)

    # Check that the write_file method was called
    mock_fs.write_file.assert_called_once()
    call_args = mock_fs.write_file.call_args
    written_path, written_content = call_args[0]

    assert written_path == config_path

    # Parse the YAML content to verify its structure and excluded None values
    data = yaml.safe_load(written_content)
    assert data["version"] == "1.0"
    assert data["log_level"] == "DEBUG"
    assert data["docker"]["dockerfile"] == "Dockerfile.dev"
    assert "image" not in data["docker"]
    assert data["hooks"]["pre_push"] is False
    assert data["filters"]["branches"] == "feature/.*"
    assert "commits" not in data["filters"]
    assert len(data["steps"]) == 1
    assert data["steps"][0]["name"] == "Build"
    assert data["steps"][0]["env"]["BUILD_TARGET"] == "production"


def test_load_config_success(
    handler_with_mock_fs: Tuple[YamlConfigurationHandler, Mock],
) -> None:
    """Verify that a valid YAML file is correctly parsed into a Configuration object."""
    handler, mock_fs = handler_with_mock_fs
    yaml_content = """
version: '1.1'
log_level: DEBUG
docker:
  image: my-image:latest
hooks:
  pre_commit: false
filters:
  commits: "fix:.*"
steps:
  - name: Test
    command: pytest
    critical: true
  - name: Lint
    command: ruff check
"""
    config_path = Path("/repo/.hookci/hookci.yaml")
    mock_fs.file_exists.return_value = True
    mock_fs.read_file.return_value = yaml_content

    config = handler.load_config(config_path)

    mock_fs.file_exists.assert_called_once_with(config_path)
    mock_fs.read_file.assert_called_once_with(config_path)

    assert config.version == "1.1"
    assert config.log_level == "DEBUG"
    assert config.docker.image == "my-image:latest"
    assert config.hooks.pre_commit is False
    assert config.filters and config.filters.commits == "fix:.*"
    assert len(config.steps) == 2
    assert config.steps[0].name == "Test"


def test_load_config_not_found(
    handler_with_mock_fs: Tuple[YamlConfigurationHandler, Mock],
) -> None:
    """Verify ConfigurationNotFoundError is raised if the file doesn't exist."""
    handler, mock_fs = handler_with_mock_fs
    config_path = Path("/nonexistent/hookci.yaml")
    mock_fs.file_exists.return_value = False

    with pytest.raises(ConfigurationNotFoundError):
        handler.load_config(config_path)


def test_load_config_bad_yaml(
    handler_with_mock_fs: Tuple[YamlConfigurationHandler, Mock],
) -> None:
    """Verify ConfigurationParseError is raised for malformed YAML."""
    handler, mock_fs = handler_with_mock_fs
    yaml_content = "version: 1.0\n  bad-indent:"
    config_path = Path("/repo/hookci.yaml")
    mock_fs.file_exists.return_value = True
    mock_fs.read_file.return_value = yaml_content

    with pytest.raises(ConfigurationParseError, match="Error parsing YAML"):
        handler.load_config(config_path)


@pytest.mark.parametrize(
    "invalid_content, error_match",
    [
        (
            """
version: 1.0
docker:
  image: 'test'
steps:
  - name: Test
""",
            "command\n  Field required",
        ),
        (
            """
docker:
  image: 'test'
steps:
  - name: Test
    command: my-cmd
""",
            "version\n  Field required",
        ),
        (
            """
version: 1.0
docker:
  image: 'test'
steps: []
log_level: 123
""",
            "log_level\n  Input should be a valid string",
        ),
        (
            """
version: 1.0
docker:
  image: 'test'
steps: not-a-list
""",
            "steps\n  Input should be a valid list",
        ),
    ],
)
def test_load_config_invalid_structure(
    handler_with_mock_fs: Tuple[YamlConfigurationHandler, Mock],
    invalid_content: str,
    error_match: str,
) -> None:
    """Verify ConfigurationParseError is raised for invalid data structures."""
    handler, mock_fs = handler_with_mock_fs
    config_path = Path("/repo/hookci.yaml")
    mock_fs.file_exists.return_value = True
    mock_fs.read_file.return_value = invalid_content

    with pytest.raises(ConfigurationParseError, match=error_match):
        handler.load_config(config_path)
