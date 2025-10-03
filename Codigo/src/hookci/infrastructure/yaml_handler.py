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
Handles serialization and deserialization of YAML configuration files.
"""
from pathlib import Path
from typing import Any, Dict, Protocol, runtime_checkable

import yaml

from hookci.infrastructure.errors import (
    ConfigurationNotFoundError,
    ConfigurationParseError,
)
from hookci.infrastructure.fs import IFileSystem


@runtime_checkable
class IConfigHandler(Protocol):
    """Interface for loading and writing configuration data."""

    def load_config_data(self, path: Path) -> Dict[str, Any]: ...
    def write_config_data(self, path: Path, config_data: Dict[str, Any]) -> None: ...


class YamlConfigHandler(IConfigHandler):
    """Handles reading and writing configuration from/to a YAML file."""

    def __init__(self, fs: IFileSystem):
        self._fs = fs

    def load_config_data(self, path: Path) -> Dict[str, Any]:
        """
        Loads and parses a YAML configuration file into a dictionary.
        """
        if not self._fs.file_exists(path):
            raise ConfigurationNotFoundError(f"Configuration file not found at: {path}")
        try:
            content = self._fs.read_file(path)
            data = yaml.safe_load(content)
            if not isinstance(data, dict):
                raise ConfigurationParseError(
                    "Top-level YAML content must be a dictionary."
                )
            return data
        except yaml.YAMLError as e:
            raise ConfigurationParseError(f"Error parsing YAML file: {e}") from e
        except Exception as e:
            raise ConfigurationParseError(
                f"Error reading configuration file: {e}"
            ) from e

    def write_config_data(self, path: Path, config_data: Dict[str, Any]) -> None:
        """
        Serializes a dictionary to YAML and writes it to a file.
        """
        self._fs.write_file(
            path,
            yaml.dump(
                config_data,
                default_flow_style=False,
                sort_keys=False,
                indent=2,
            ),
        )
