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
Tests for the Dependency Injection container.
"""
import pytest
from unittest.mock import patch

from docker.errors import DockerException

from hookci.application.services import (
    CiExecutionService,
    MigrationService,
    ProjectInitService,
)
from hookci.containers import Container
from hookci.infrastructure.docker import IDockerService
from hookci.infrastructure.fs import IFileSystem, IScmService
from hookci.infrastructure.yaml_handler import IConfigHandler


def test_container_instantiation_and_wiring() -> None:
    """
    Verify that the DI container can be instantiated and all services
    can be resolved, checking their types. This ensures all cached_properties
    are executed for coverage.
    """
    # Mock external dependencies that might fail in a test environment
    with patch("subprocess.run"), patch(
        "docker.from_env",
    ):
        container = Container()

        # Assert that each property returns an object of the correct type
        assert isinstance(container.file_system, IFileSystem)
        assert isinstance(container.git_service, IScmService)
        assert isinstance(container.config_handler, IConfigHandler)
        assert isinstance(container.project_init_service, ProjectInitService)
        assert isinstance(container.migration_service, MigrationService)
        assert isinstance(container.docker_service, IDockerService)
        assert isinstance(container.ci_execution_service, CiExecutionService)


def test_container_docker_service_init_failure() -> None:
    """
    Verify that a DockerException during DockerService initialization is handled.
    """
    with patch("subprocess.run"), patch(
        "docker.from_env", side_effect=DockerException("cannot connect")
    ):
        container = Container()
        with patch("hookci.containers.DockerService") as mock_docker_service_class:
            mock_docker_service_class.side_effect = DockerException("cannot connect")
            with pytest.raises(DockerException):
                _ = container.docker_service
