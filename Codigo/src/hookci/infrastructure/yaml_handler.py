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
Handles serialization and deserialization of YAML configuration files.
"""
import dataclasses
from pathlib import Path
from typing import Any, List, Tuple, Dict

import yaml
from hookci.domain.config import Configuration
from hookci.infrastructure.fs import IFileSystem


def _clean_dict_factory(data: List[Tuple[str, Any]]) -> Dict[str, Any]:
    """
    A dict_factory for dataclasses.asdict that filters out fields with a value of None.
    """
    return {key: value for key, value in data if value is not None}


class YamlConfigurationHandler:
    """Handles writing configuration to a YAML file."""

    def __init__(self, fs: IFileSystem):
        self._fs = fs

    def write_config(self, path: Path, config: Configuration) -> None:
        """
        Serializes a Configuration object to YAML and writes it to a file.
        """
        # Convert the entire dataclass structure to a dictionary, filtering out None values
        config_dict = dataclasses.asdict(config, dict_factory=_clean_dict_factory)

        self._fs.write_file(
            path,
            yaml.dump(
                config_dict,
                default_flow_style=False,
                sort_keys=False,
                indent=2,
            ),
        )
