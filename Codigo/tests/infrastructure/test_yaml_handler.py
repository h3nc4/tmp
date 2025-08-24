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
from unittest.mock import Mock

import yaml
from hookci.domain.config import Configuration, Docker, Filters, Step
from hookci.infrastructure.fs import IFileSystem
from hookci.infrastructure.yaml_handler import YamlConfigurationHandler


def test_write_config_serializes_correctly() -> None:
    """
    Verify that a Configuration object is serialized to the correct YAML format.
    """
    mock_fs = Mock(spec=IFileSystem)
    handler = YamlConfigurationHandler(fs=mock_fs)

    config = Configuration(
        version="1.0",
        log_level="DEBUG",
        docker=Docker(dockerfile="Dockerfile.dev"),
        filters=Filters(branches="feature/.*"),
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

    # Get the arguments passed to write_file
    call_args = mock_fs.write_file.call_args
    written_path = call_args[0][0]
    written_content = call_args[0][1]

    assert written_path == config_path

    # Parse the YAML content to verify its structure
    data = yaml.safe_load(written_content)
    assert data["version"] == "1.0"
    assert data["log_level"] == "DEBUG"
    assert data["docker"]["dockerfile"] == "Dockerfile.dev"
    assert "image" not in data["docker"]  # None values should be excluded
    assert data["filters"]["branches"] == "feature/.*"
    assert "commits" not in data["filters"]
    assert len(data["steps"]) == 1
    assert data["steps"][0]["name"] == "Build"
    assert data["steps"][0]["env"]["BUILD_TARGET"] == "production"
