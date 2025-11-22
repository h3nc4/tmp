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
from functools import cached_property

from hookci.application.services import (
    CiExecutionService,
    MigrationService,
    ProjectInitService,
)
from hookci.infrastructure.docker import DockerService, IDockerService
from hookci.infrastructure.fs import (
    GitService,
    IFileSystem,
    IScmService,
    LocalFileSystem,
)
from hookci.infrastructure.yaml_handler import (
    IConfigHandler,
    YamlConfigHandler,
)


class Container:
    """
    A simple container for dependency injection using cached properties.
    Services are instantiated lazily on their first access.
    """

    @cached_property
    def file_system(self) -> IFileSystem:
        return LocalFileSystem()

    @cached_property
    def git_service(self) -> IScmService:
        return GitService(fs=self.file_system)

    @cached_property
    def docker_service(self) -> IDockerService:
        return DockerService()

    @cached_property
    def config_handler(self) -> IConfigHandler:
        return YamlConfigHandler(fs=self.file_system)

    @cached_property
    def project_init_service(self) -> ProjectInitService:
        return ProjectInitService(
            git_service=self.git_service,
            fs=self.file_system,
            config_handler=self.config_handler,
        )

    @cached_property
    def ci_execution_service(self) -> CiExecutionService:
        return CiExecutionService(
            git_service=self.git_service,
            config_handler=self.config_handler,
            docker_service=self.docker_service,
            fs=self.file_system,
        )

    @cached_property
    def migration_service(self) -> MigrationService:
        return MigrationService(
            git_service=self.git_service,
            config_handler=self.config_handler,
        )


# A singleton instance of the container, making it easily accessible
# throughout the application while ensuring services are singletons too.
container = Container()
