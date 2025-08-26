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
Dependency Injection Container.

This module centralizes the creation and wiring of application components,
such as services and infrastructure handlers. It follows the Dependency
Inversion Principle, allowing high-level modules (like the CLI) to depend on
abstractions rather than concrete implementations.
"""
from typing import Any, Dict, cast

from hookci.application.services import (
    CiExecutionService,
    ProjectInitializationService,
)
from hookci.infrastructure.fs import (
    GitService,
    IFileSystem,
    IGitService,
    LocalFileSystem,
)
from hookci.infrastructure.yaml_handler import (
    IConfigurationHandler,
    YamlConfigurationHandler,
)


class Container:
    """A simple container for dependency injection."""

    def __init__(self) -> None:
        self._instances: Dict[str, Any] = {}

    @property
    def file_system(self) -> IFileSystem:
        if "file_system" not in self._instances:
            self._instances["file_system"] = LocalFileSystem()
        return cast(IFileSystem, self._instances["file_system"])

    @property
    def git_service(self) -> IGitService:
        if "git_service" not in self._instances:
            self._instances["git_service"] = GitService()
        return cast(IGitService, self._instances["git_service"])

    @property
    def config_handler(self) -> IConfigurationHandler:
        if "config_handler" not in self._instances:
            self._instances["config_handler"] = YamlConfigurationHandler(
                fs=self.file_system
            )
        return cast(IConfigurationHandler, self._instances["config_handler"])

    @property
    def project_init_service(self) -> ProjectInitializationService:
        if "project_init_service" not in self._instances:
            self._instances["project_init_service"] = ProjectInitializationService(
                git_service=self.git_service,
                fs=self.file_system,
                config_handler=self.config_handler,
            )
        return cast(
            ProjectInitializationService, self._instances["project_init_service"]
        )

    @property
    def ci_execution_service(self) -> CiExecutionService:
        if "ci_execution_service" not in self._instances:
            self._instances["ci_execution_service"] = CiExecutionService(
                git_service=self.git_service,
                config_handler=self.config_handler,
            )
        return cast(CiExecutionService, self._instances["ci_execution_service"])


container = Container()
