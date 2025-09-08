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

"""Tests for the Docker infrastructure service."""
from pathlib import Path
from typing import Generator
from unittest.mock import MagicMock, patch

import pytest
from docker.errors import BuildError, DockerException, ImageNotFound

from hookci.infrastructure import constants
from hookci.infrastructure.docker import DockerService
from hookci.infrastructure.errors import DockerError


@patch("docker.from_env")
def test_docker_service_init_failure(mock_from_env: MagicMock) -> None:
    """Verify DockerError is raised if the Docker daemon is not available."""
    mock_docker_client = MagicMock()
    mock_from_env.return_value = mock_docker_client
    mock_docker_client.ping.side_effect = DockerException("daemon not found")

    with pytest.raises(DockerError, match="Could not connect to the Docker daemon"):
        DockerService()


@patch("docker.from_env")
def test_build_image_success_streams_logs(
    mock_from_env: MagicMock, tmp_path: Path
) -> None:
    """Verify the build process is called and yields logs correctly."""
    mock_docker_client = MagicMock()
    mock_from_env.return_value = mock_docker_client
    mock_logs = iter(
        [
            {"stream": "Step 1/2 : FROM python"},
            {"stream": " ---> 12345"},
            {"stream": "Step 2/2 : RUN echo 'hello'"},
            {"stream": " ---> 67890"},
        ]
    )
    mock_docker_client.images.build.return_value = (None, mock_logs)

    service = DockerService()
    dockerfile = tmp_path / "Dockerfile"
    dockerfile.touch()

    build_generator = service.build_image(dockerfile, "test-tag")
    logs = list(build_generator)

    assert isinstance(build_generator, Generator)
    assert "Step 1/2" in logs[0]
    assert "Step 2/2" in logs[2]
    mock_docker_client.images.build.assert_called_once_with(
        path=str(tmp_path),
        dockerfile="Dockerfile",
        tag="test-tag",
        rm=True,
    )


@patch("docker.from_env")
def test_build_image_failure(mock_from_env: MagicMock, tmp_path: Path) -> None:
    """Verify DockerError is raised on a build failure."""
    mock_docker_client = MagicMock()
    mock_from_env.return_value = mock_docker_client
    mock_docker_client.images.build.side_effect = BuildError("build failed", {})  # type: ignore[no-untyped-call]

    service = DockerService()
    with pytest.raises(DockerError, match="Failed to build Docker image"):
        # Consume the generator to trigger the exception
        list(service.build_image(tmp_path / "Dockerfile", "test-tag"))


@patch("docker.from_env")
def test_run_command_success_streams_and_returns_code(
    mock_from_env: MagicMock, tmp_path: Path
) -> None:
    """Verify a command runs, yields logs, and returns the correct exit code."""
    mock_docker_client = MagicMock()
    mock_from_env.return_value = mock_docker_client
    mock_container = MagicMock()
    mock_docker_client.containers.run.return_value = mock_container
    mock_container.logs.return_value = [b"log line 1\n", b"log line 2\n"]
    mock_container.wait.return_value = {"StatusCode": 0}

    service = DockerService()
    command_str = "pytest && echo 'done'"
    command_generator = service.run_command_in_container(
        image="my-image", command=command_str, workdir=tmp_path, env={"CI": "true"}
    )

    assert isinstance(command_generator, Generator)

    # Correctly consume the generator and get its return value
    logs = []
    exit_code = -1
    try:
        while True:
            logs.append(next(command_generator))
    except StopIteration as e:
        exit_code = e.value

    assert logs == ["log line 1\n", "log line 2\n"]
    assert exit_code == 0

    mock_docker_client.containers.run.assert_called_once_with(
        image="my-image",
        command=["/bin/sh", "-c", command_str],
        volumes={str(tmp_path): {"bind": constants.CONTAINER_WORKDIR, "mode": "rw"}},
        working_dir=constants.CONTAINER_WORKDIR,
        environment={"CI": "true"},
        detach=True,
    )
    mock_container.remove.assert_called_once()


@patch("docker.from_env")
def test_run_command_image_not_found(mock_from_env: MagicMock, tmp_path: Path) -> None:
    """Verify DockerError is raised when the image is not found."""
    mock_docker_client = MagicMock()
    mock_from_env.return_value = mock_docker_client
    mock_docker_client.containers.run.side_effect = ImageNotFound("not found")  # type: ignore[no-untyped-call]

    service = DockerService()
    with pytest.raises(DockerError, match="Docker image 'my-image' not found"):
        list(service.run_command_in_container("my-image", "cmd", tmp_path))
