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
Application services that orchestrate use cases.
"""
from pathlib import Path
from hookci.application.errors import ProjectAlreadyInitializedError
from hookci.domain.config import create_default_config
from hookci.infrastructure.fs import IFileSystem, IGitService
from hookci.infrastructure.yaml_handler import YamlConfigurationHandler


class ProjectInitializationService:
    """Service to handle the project initialization use case."""
    CONFIG_FILENAME = "hookci.yaml"

    def __init__(
        self,
        git_service: IGitService,
        fs: IFileSystem,
        config_handler: YamlConfigurationHandler,
    ):
        self._git_service = git_service
        self._fs = fs
        self._config_handler = config_handler

    def run(self) -> Path:
        """
        Executes the project initialization logic.

        1. Finds the Git repository root.
        2. Checks if the project is already initialized.
        3. Creates the default hookci.yaml file.
        4. (Future) Installs Git hooks.

        Returns:
            The path to the created configuration file.
        """
        git_root = self._git_service.find_git_root()
        config_path = git_root / self.CONFIG_FILENAME

        if self._fs.file_exists(config_path):
            raise ProjectAlreadyInitializedError(
                f"Project already initialized. Config file exists: {config_path}"
            )

        default_config = create_default_config()
        self._config_handler.write_config(config_path, default_config)

        # TODO: Implement Git hook installation in a future task (US04)

        return config_path
