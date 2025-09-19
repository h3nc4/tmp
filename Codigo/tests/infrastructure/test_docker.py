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
import struct
from pathlib import Path
from typing import Generator
from unittest.mock import MagicMock, patch

import pytest
from docker.errors import APIError, BuildError, DockerException, ImageNotFound

from hookci.infrastructure import constants
from hookci.infrastructure.docker import DockerService
from hookci.infrastructure.errors import DockerError


@pytest.fixture
def mock_docker_client() -> MagicMock:
    """Provides a mocked docker client."""
    return MagicMock()


@pytest.fixture
def docker_service(mock_docker_client: MagicMock) -> DockerService:
    """Provides a DockerService instance with a mocked client."""
    with patch("docker.from_env", return_value=mock_docker_client):
        service = DockerService()
        mock_docker_client.ping.assert_called_once()
        return service


def test_docker_service_init_failure() -> None:
    """Verify DockerError is raised if the Docker daemon is not available."""
    with patch("docker.from_env") as mock_from_env:
        mock_docker_client = MagicMock()
        mock_from_env.return_value = mock_docker_client
        mock_docker_client.ping.side_effect = DockerException("daemon not found")

        with pytest.raises(DockerError, match="Could not connect to the Docker daemon"):
            DockerService()


def test_build_image_success_streams_logs(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify the build process is called and yields logs correctly."""
    mock_logs = iter(
        [
            {"stream": "Step 1/2 : FROM python"},
            {"stream": " ---> 12345"},
            {"stream": "Step 2/2 : RUN echo 'hello'"},
            {"stream": " ---> 67890"},
        ]
    )
    mock_docker_client.images.build.return_value = (None, mock_logs)

    dockerfile = tmp_path / "Dockerfile"
    dockerfile.touch()

    build_generator = docker_service.build_image(dockerfile, "test-tag")
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


def test_build_image_failure(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify DockerError is raised on a build failure."""
    mock_docker_client.images.build.side_effect = BuildError("build failed", {})  # type: ignore[no-untyped-call]

    with pytest.raises(DockerError, match="Failed to build Docker image"):
        # Consume the generator to trigger the exception
        list(docker_service.build_image(tmp_path / "Dockerfile", "test-tag"))


def create_docker_log_stream(
    lines: list[tuple[int, str]],
) -> Generator[bytes, None, None]:
    """Helper to create a multiplexed Docker log stream for mocking."""
    for stream_type, content in lines:
        content_bytes = content.encode("utf-8")
        header = struct.pack(">BxxxL", stream_type, len(content_bytes))
        yield header + content_bytes


def test_run_command_success_demultiplexes_and_returns_code(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify a command runs, yields demultiplexed logs, and returns the correct exit code."""
    mock_container = MagicMock()
    mock_docker_client.containers.run.return_value = mock_container

    # Mock the log stream with multiplexed stdout and stderr
    log_stream = create_docker_log_stream(
        [
            (1, "stdout line 1\n"),
            (2, "stderr line 1\n"),
            (1, "stdout line 2\n"),
        ]
    )
    mock_container.logs.return_value = log_stream
    mock_container.wait.return_value = {"StatusCode": 0}

    command_str = "pytest && echo 'done'"
    command_generator = docker_service.run_command_in_container(
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

    assert logs == [
        ("stdout", "stdout line 1\n"),
        ("stderr", "stderr line 1\n"),
        ("stdout", "stdout line 2\n"),
    ]
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


def test_run_command_image_not_found(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify DockerError is raised when the image is not found."""
    mock_docker_client.containers.run.side_effect = ImageNotFound("not found")  # type: ignore[no-untyped-call]

    with pytest.raises(DockerError, match="Docker image 'my-image' not found"):
        list(docker_service.run_command_in_container("my-image", "cmd", tmp_path))


def test_start_persistent_container(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify a persistent container is started correctly and its ID is returned."""
    mock_container = MagicMock()
    mock_container.id = "persistent_id_123"
    mock_docker_client.containers.run.return_value = mock_container

    container_id = docker_service.start_persistent_container(
        image="my-image", workdir=tmp_path
    )

    assert container_id == "persistent_id_123"
    mock_docker_client.containers.run.assert_called_once_with(
        image="my-image",
        command=["tail", "-f", "/dev/null"],
        volumes={str(tmp_path): {"bind": constants.CONTAINER_WORKDIR, "mode": "rw"}},
        working_dir=constants.CONTAINER_WORKDIR,
        detach=True,
    )


def test_exec_in_container(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify exec_in_container runs a command and returns the exit code."""
    mock_container = MagicMock()
    mock_container.id = "container_id_abc"
    mock_docker_client.containers.get.return_value = mock_container

    # Mock the low-level API calls
    mock_docker_client.api.exec_create.return_value = {"Id": "exec_id_456"}
    mock_docker_client.api.exec_start.return_value = create_docker_log_stream(
        [(1, "exec stdout"), (2, "exec stderr")]
    )
    mock_docker_client.api.exec_inspect.return_value = {"ExitCode": 123}

    command = "echo 'hello'"
    gen = docker_service.exec_in_container(
        "container_id_abc", command, env={"VAR": "val"}
    )

    # Correctly consume the generator to get logs and return value
    logs = []
    exit_code = -1
    try:
        while True:
            logs.append(next(gen))
    except StopIteration as e:
        exit_code = e.value

    assert exit_code == 123
    assert logs == [("stdout", "exec stdout"), ("stderr", "exec stderr")]

    mock_docker_client.containers.get.assert_called_once_with("container_id_abc")
    mock_docker_client.api.exec_create.assert_called_once_with(
        "container_id_abc",
        cmd=["/bin/sh", "-c", command],
        environment={"VAR": "val"},
    )
    mock_docker_client.api.exec_start.assert_called_once_with(
        "exec_id_456", stream=True
    )
    mock_docker_client.api.exec_inspect.assert_called_once_with("exec_id_456")


def test_stop_and_remove_container(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify the service stops and removes a container by ID."""
    mock_container = MagicMock()
    mock_docker_client.containers.get.return_value = mock_container

    docker_service.stop_and_remove_container("container_id")

    mock_docker_client.containers.get.assert_called_once_with("container_id")
    mock_container.stop.assert_called_once_with(timeout=1)
    mock_container.remove.assert_called_once()


def test_stop_and_remove_container_api_error(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify API errors during cleanup are caught and logged as warnings."""
    mock_docker_client.containers.get.side_effect = APIError("not found")  # type: ignore[no-untyped-call]

    # This should not raise an exception
    docker_service.stop_and_remove_container("container_id")
