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
from typing import Protocol

from pydantic import ValidationError
import yaml

from hookci.domain.config import Configuration
from hookci.infrastructure.errors import (
    ConfigurationNotFoundError,
    ConfigurationParseError,
)
from hookci.infrastructure.fs import IFileSystem


class IConfigurationHandler(Protocol):
    """Interface for loading and writing configuration."""

    def load_config(self, path: Path) -> Configuration: ...
    def write_config(self, path: Path, config: Configuration) -> None: ...


class YamlConfigurationHandler(IConfigurationHandler):
    """Handles reading and writing configuration from/to a YAML file."""

    def __init__(self, fs: IFileSystem):
        self._fs = fs

    def load_config(self, path: Path) -> Configuration:
        """
        Loads, parses, and validates a YAML configuration file into a Configuration object.
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
            # Pydantic handles all validation and mapping from the dictionary.
            return Configuration.model_validate(data)
        except yaml.YAMLError as e:
            raise ConfigurationParseError(f"Error parsing YAML file: {e}") from e
        except ValidationError as e:
            raise ConfigurationParseError(
                f"Invalid configuration structure:\n{e}"
            ) from e

    def write_config(self, path: Path, config: Configuration) -> None:
        """
        Serializes a Configuration object to YAML and writes it to a file.
        """
        # Convert the Pydantic model to a dictionary, filtering out fields with None values.
        config_dict = config.model_dump(exclude_none=True)

        self._fs.write_file(
            path,
            yaml.dump(
                config_dict,
                default_flow_style=False,
                sort_keys=False,
                indent=2,
            ),
        )
