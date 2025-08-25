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

from hookci.application import constants
from hookci.application.errors import ProjectAlreadyInitializedError
from hookci.domain.config import create_default_config
from hookci.infrastructure.fs import IFileSystem, IGitService
from hookci.infrastructure.yaml_handler import YamlConfigurationHandler


class ProjectInitializationService:
    """Service to handle the project initialization use case."""

    _HOOKS_DIR_NAME: str = "hooks"
    _PRE_COMMIT_FILENAME: str = "pre-commit"
    _PRE_PUSH_FILENAME: str = "pre-push"

    _PRE_COMMIT_SCRIPT: str = """#!/usr/bin/env sh
# HookCI pre-commit hook

hookci run --hook-type pre-commit
"""

    _PRE_PUSH_SCRIPT: str = """#!/usr/bin/env sh
# HookCI pre-push hook

hookci run --hook-type pre-push
"""

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
        2. Creates the .hookci directory structure.
        3. Checks if the project is already initialized.
        4. Creates the default hookci.yaml file.
        5. Installs Git hooks scripts.
        6. Configures Git to use the new hooks path.

        Returns:
            The path to the created configuration file.
        """
        git_root = self._git_service.find_git_root()
        base_dir = git_root / constants.BASE_DIR_NAME
        hooks_dir = base_dir / self._HOOKS_DIR_NAME
        config_path = base_dir / constants.CONFIG_FILENAME

        if self._fs.file_exists(config_path):
            raise ProjectAlreadyInitializedError(
                f"Project already initialized. Config file exists: {config_path}"
            )

        self._fs.create_dir(hooks_dir)
        default_config = create_default_config()
        self._config_handler.write_config(config_path, default_config)
        self._install_hook_script(
            hooks_dir, self._PRE_COMMIT_FILENAME, self._PRE_COMMIT_SCRIPT
        )
        self._install_hook_script(
            hooks_dir, self._PRE_PUSH_FILENAME, self._PRE_PUSH_SCRIPT
        )
        self._git_service.set_hooks_path(hooks_dir)

        return config_path

    def _install_hook_script(
        self, hooks_dir: Path, hook_name: str, content: str
    ) -> None:
        """Writes the hook script and makes it executable."""
        hook_path = hooks_dir / hook_name
        self._fs.write_file(hook_path, content)
        self._fs.make_executable(hook_path)
