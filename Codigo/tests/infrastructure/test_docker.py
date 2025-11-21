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


def test_image_exists(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify image_exists returns True if image is found."""
    mock_docker_client.images.get.return_value = MagicMock()
    assert docker_service.image_exists("my-tag") is True
    mock_docker_client.images.get.assert_called_once_with("my-tag")


def test_image_does_not_exist(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify image_exists returns False if ImageNotFound is raised."""
    mock_docker_client.images.get.side_effect = ImageNotFound("not found")  # type: ignore[no-untyped-call]
    assert docker_service.image_exists("my-tag") is False


def test_image_exists_api_error(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify DockerError is raised on API error when checking for image."""
    mock_docker_client.images.get.side_effect = APIError("server error")  # type: ignore[no-untyped-call]
    with pytest.raises(DockerError, match="Docker error when checking for image"):
        docker_service.image_exists("my-tag")


def test_pull_image_success(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify pull_image calls the correct client method and completes."""
    # The generator should be consumable without error.
    list(docker_service.pull_image("my-image:latest"))
    mock_docker_client.images.pull.assert_called_once_with("my-image:latest")


def test_pull_image_not_found(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify DockerError is raised on ImageNotFound during pull."""
    mock_docker_client.images.pull.side_effect = ImageNotFound("not found")  # type: ignore[no-untyped-call]
    with pytest.raises(DockerError, match="not found in any registry"):
        list(docker_service.pull_image("my-image:latest"))


def test_pull_image_api_error(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify DockerError is raised on API error during pull."""
    mock_docker_client.images.pull.side_effect = APIError("server error")  # type: ignore[no-untyped-call]
    with pytest.raises(DockerError, match="Docker error while pulling image"):
        list(docker_service.pull_image("my-image:latest"))


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
    assert logs[0] == (1, "Step 1/2 : FROM python")
    assert logs[2] == (2, "Step 2/2 : RUN echo 'hello'")
    mock_docker_client.images.build.assert_called_once_with(
        path=str(tmp_path),
        dockerfile="Dockerfile",
        tag="test-tag",
        rm=True,
    )


def test_build_image_skips_empty_lines(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify that empty lines in the build stream are skipped."""
    mock_logs = iter(
        [
            {"stream": "\n"},  # Empty line
            {"stream": "  "},  # Whitespace line
            {"stream": "Step 1/1 : FROM python"},
        ]
    )
    mock_docker_client.images.build.return_value = (None, mock_logs)
    dockerfile = tmp_path / "Dockerfile"
    dockerfile.touch()

    logs = list(docker_service.build_image(dockerfile, "tag"))
    assert len(logs) == 1
    assert logs[0] == (1, "Step 1/1 : FROM python")


def test_build_image_api_error(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify DockerError is raised on a build API failure."""
    mock_docker_client.images.build.side_effect = APIError("server error")  # type: ignore[no-untyped-call]
    with pytest.raises(DockerError, match="Docker error during build"):
        list(docker_service.build_image(tmp_path / "Dockerfile", "test-tag"))


def test_build_image_failure_in_log(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify DockerError is raised on a build failure reported in the log stream."""
    mock_logs = iter([{"error": "The command 'apt-get' returned a non-zero code."}])
    mock_docker_client.images.build.return_value = (None, mock_logs)
    with pytest.raises(DockerError, match="Failed to build Docker image"):
        list(docker_service.build_image(tmp_path / "Dockerfile", "test-tag"))


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


def test_parse_one_frame_malformed_header(docker_service: DockerService) -> None:
    """Verify a malformed header is handled gracefully."""
    # Test buffer too small for a valid header, should return None and wait for more data.
    small_buffer = b"1234567"
    frame, remaining = docker_service._parse_one_frame(small_buffer)
    assert frame is None
    assert remaining == small_buffer

    # Test buffer where header indicates a payload larger than available
    malformed_header = struct.pack(">BxxxL", 1, 100)  # Header for 100 bytes
    payload = b"some data"  # Only 9 bytes of payload
    buffer_with_bad_payload_length = malformed_header + payload
    frame, remaining = docker_service._parse_one_frame(buffer_with_bad_payload_length)
    assert frame is None
    assert remaining == buffer_with_bad_payload_length

    # Test buffer that causes struct.error because it's the wrong size for unpacking
    with patch("hookci.infrastructure.docker.struct.unpack", side_effect=struct.error):
        frame, remaining = docker_service._parse_one_frame(b"12345678")
        assert frame == ("stdout", "12345678")
        assert remaining == b""


def test_demultiplex_docker_stream_incomplete_final_chunk(
    docker_service: DockerService,
) -> None:
    """Verify that an incomplete final chunk in the stream is processed."""

    def stream_generator() -> Generator[bytes, None, None]:
        # A valid frame
        content = b"hello"
        header = struct.pack(">BxxxL", 1, len(content))
        yield header + content
        # An incomplete chunk at the end
        yield b"world"

    logs = list(docker_service._demultiplex_docker_stream(stream_generator()))
    assert logs == [("stdout", "hello"), ("stdout", "world")]


def test_run_command_success_demultiplexes_and_returns_code(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify a command runs, yields demultiplexed logs, and returns the correct exit code."""
    mock_container = MagicMock()
    mock_docker_client.containers.run.return_value = mock_container
    log_stream = create_docker_log_stream(
        [(1, "stdout line 1\n"), (2, "stderr line 1\n")]
    )
    mock_container.logs.return_value = log_stream
    mock_container.wait.return_value = {"StatusCode": 0}
    command_str = "pytest"
    command_generator = docker_service.run_command_in_container(
        image="my-image", command=command_str, workdir=tmp_path, env={"CI": "true"}
    )
    logs = []
    exit_code = -1
    try:
        while True:
            logs.append(next(command_generator))
    except StopIteration as e:
        exit_code = e.value
    assert logs == [("stdout", "stdout line 1\n"), ("stderr", "stderr line 1\n")]
    assert exit_code == 0
    mock_container.remove.assert_called_once()


def test_run_command_no_cleanup_if_container_fails_to_create(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify container.remove is not called if the container object is never created."""
    mock_container = MagicMock()
    # Mock the run call to first assign the mock, then raise an error.
    # This is a bit tricky, so we'll just check that remove is not called on the mock.
    mock_docker_client.containers.run.side_effect = APIError("server error")  # type: ignore[no-untyped-call]

    with pytest.raises(DockerError):
        # We need a new mock for each test to check call counts accurately
        docker_service.client.containers.run.return_value = mock_container
        list(docker_service.run_command_in_container("img", "cmd", tmp_path))

    # The key assertion: remove should not have been called because the 'container'
    # variable in the try block was never successfully assigned.
    mock_container.remove.assert_not_called()


def test_run_command_cleanup_failure_is_logged(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify that exceptions during container cleanup are logged and do not crash."""
    mock_container = MagicMock()
    mock_docker_client.containers.run.return_value = mock_container
    # Set up the container to fail on remove
    mock_container.remove.side_effect = DockerException("Cleanup failure")
    mock_container.wait.return_value = {"StatusCode": 0}
    mock_container.logs.return_value = iter([])

    with patch("hookci.infrastructure.docker.logger") as mock_logger:
        list(docker_service.run_command_in_container("img", "cmd", tmp_path))
        mock_logger.warning.assert_called_once()
        assert "Failed to remove transient container" in mock_logger.warning.call_args[0][0]


def test_run_command_api_error(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify DockerError is raised on a container run API error."""
    mock_docker_client.containers.run.side_effect = APIError("server error")  # type: ignore[no-untyped-call]
    with pytest.raises(DockerError, match="Docker error:"):
        list(docker_service.run_command_in_container("my-image", "cmd", tmp_path))


def test_run_command_image_not_found(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify DockerError is raised when the image is not found."""
    mock_docker_client.containers.run.side_effect = ImageNotFound("not found")  # type: ignore[no-untyped-call]
    with pytest.raises(DockerError, match="Docker image 'my-image' not found"):
        list(docker_service.run_command_in_container("my-image", "cmd", tmp_path))


def test_count_dockerfile_steps(docker_service: DockerService, tmp_path: Path) -> None:
    """Verify Dockerfile steps are counted correctly, ignoring comments and empty lines."""
    dockerfile_content = """
# This is a comment
FROM python:3.9

RUN pip install poetry
# Another comment

COPY . .
    # Indented comment
RUN poetry install
"""
    dockerfile = tmp_path / "Dockerfile"
    dockerfile.write_text(dockerfile_content)
    assert docker_service.count_dockerfile_steps(dockerfile) == 4


def test_count_dockerfile_steps_read_error(
    docker_service: DockerService, tmp_path: Path
) -> None:
    """Verify DockerError is raised if reading the Dockerfile fails."""
    dockerfile = tmp_path / "Dockerfile"
    with patch.object(Path, "open", side_effect=OSError("Read error")):
        with pytest.raises(DockerError, match="Could not read Dockerfile"):
            docker_service.count_dockerfile_steps(dockerfile)


def test_calculate_dockerfile_hash(
    docker_service: DockerService, tmp_path: Path
) -> None:
    """Verify the Dockerfile hash is consistent and correct."""
    dockerfile = tmp_path / "Dockerfile"
    dockerfile.write_text("FROM python:3.9\nRUN echo 'hello'")
    expected_hash = "ea8729087122"  # sha256(...).hexdigest()[:12]
    assert docker_service.calculate_dockerfile_hash(dockerfile) == expected_hash


def test_calculate_dockerfile_hash_read_error(
    docker_service: DockerService, tmp_path: Path
) -> None:
    """Verify DockerError is raised if reading the Dockerfile hash fails."""
    dockerfile = tmp_path / "Dockerfile"
    with patch.object(Path, "open", side_effect=OSError("Read error")):
        with pytest.raises(DockerError, match="Could not read Dockerfile"):
            docker_service.calculate_dockerfile_hash(dockerfile)


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


def test_start_persistent_container_image_not_found(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify DockerError for ImageNotFound on starting a persistent container."""
    mock_docker_client.containers.run.side_effect = ImageNotFound("not found")  # type: ignore[no-untyped-call]
    with pytest.raises(DockerError, match="Docker image 'my-image' not found"):
        docker_service.start_persistent_container(image="my-image", workdir=tmp_path)


def test_exec_in_container_success(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify exec_in_container streams logs and returns exit code on success."""
    mock_container = MagicMock()
    mock_container.id = "container_id_abc"
    mock_docker_client.containers.get.return_value = mock_container

    mock_docker_client.api.exec_create.return_value = {"Id": "exec_id_456"}
    log_stream = create_docker_log_stream([(1, "stdout log\n"), (2, "stderr log\n")])
    mock_docker_client.api.exec_start.return_value = log_stream
    mock_docker_client.api.exec_inspect.return_value = {"ExitCode": 0}

    gen = docker_service.exec_in_container("container_id_abc", "echo 'hello'")

    logs = []
    exit_code = -1
    try:
        while True:
            logs.append(next(gen))
    except StopIteration as e:
        exit_code = e.value

    assert logs == [("stdout", "stdout log\n"), ("stderr", "stderr log\n")]
    assert exit_code == 0


def test_exec_in_container_api_error(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify DockerError on API error during exec."""
    mock_docker_client.containers.get.side_effect = APIError("not found")  # type: ignore[no-untyped-call]
    with pytest.raises(DockerError, match="Docker error during exec"):
        list(docker_service.exec_in_container("container_id_abc", "echo 'hello'"))


def test_exec_in_container_no_exit_code(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify DockerError if the exit code cannot be determined after exec."""
    mock_container = MagicMock()
    mock_container.id = "container_id_abc"
    mock_docker_client.containers.get.return_value = mock_container
    mock_docker_client.api.exec_create.return_value = {"Id": "exec_id_456"}
    mock_docker_client.api.exec_start.return_value = create_docker_log_stream([])
    mock_docker_client.api.exec_inspect.return_value = {}  # No ExitCode
    with pytest.raises(DockerError, match="Could not determine exit code"):
        list(docker_service.exec_in_container("container_id_abc", "echo 'hello'"))


def test_exec_in_container_raises_if_exit_code_is_none(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify a DockerError is raised if exec_inspect returns an explicit None for ExitCode."""
    mock_container = MagicMock(id="c1")
    mock_docker_client.containers.get.return_value = mock_container
    mock_docker_client.api.exec_create.return_value = {"Id": "e1"}
    # Simulate a stream that yields nothing
    mock_docker_client.api.exec_start.return_value = iter([])
    # Simulate the API returning a dict where the key is present but the value is None
    mock_docker_client.api.exec_inspect.return_value = {"ExitCode": None}

    with pytest.raises(DockerError, match="Could not determine exit code"):
        # list() fully consumes the generator, forcing the final inspection
        list(docker_service.exec_in_container("c1", "cmd"))


def test_stop_and_remove_container_success(
    docker_service: DockerService, mock_docker_client: MagicMock
) -> None:
    """Verify container is stopped and removed successfully."""
    mock_container = MagicMock()
    mock_docker_client.containers.get.return_value = mock_container

    docker_service.stop_and_remove_container("container_id")

    mock_container.stop.assert_called_once_with(timeout=1)
    mock_container.remove.assert_called_once()


@patch("hookci.infrastructure.docker.logger")
@pytest.mark.parametrize(
    "fail_on",
    [
        "get",
        "stop",
        "remove",
    ],
)
def test_stop_and_remove_container_api_error(
    mock_logger: MagicMock,
    fail_on: str,
    docker_service: DockerService,
    mock_docker_client: MagicMock,
) -> None:
    """Verify API errors during cleanup are caught and logged as warnings."""
    mock_container = MagicMock()
    if fail_on == "get":
        mock_docker_client.containers.get.side_effect = APIError("not found")  # type: ignore[no-untyped-call]
    else:
        mock_docker_client.containers.get.return_value = mock_container
        if fail_on == "stop":
            mock_container.stop.side_effect = APIError("cannot stop")  # type: ignore[no-untyped-call]
        elif fail_on == "remove":
            mock_container.remove.side_effect = APIError("cannot remove")  # type: ignore[no-untyped-call]

    docker_service.stop_and_remove_container("container_id")

    mock_logger.warning.assert_called_once()
    assert "Could not stop or remove container" in mock_logger.warning.call_args[0][0]


def test_start_persistent_container_api_error(
    docker_service: DockerService, mock_docker_client: MagicMock, tmp_path: Path
) -> None:
    """Verify DockerError for APIError on starting a persistent container."""
    mock_docker_client.containers.run.side_effect = APIError("server error")  # type: ignore[no-untyped-call]
    with pytest.raises(DockerError, match="Docker error:"):
        docker_service.start_persistent_container(image="my-image", workdir=tmp_path)


def test_format_error_msg_uses_explanation(docker_service: DockerService) -> None:
    """Verify _format_error_msg uses explanation if available on APIError."""
    api_error = APIError("Some generic message")  # type: ignore[no-untyped-call]
    api_error.explanation = "Detailed explanation of the error"
    msg = docker_service._format_error_msg(api_error)
    assert msg == "Detailed explanation of the error"


def test_format_error_msg_falls_back_to_str(docker_service: DockerService) -> None:
    """Verify _format_error_msg falls back to str(e) for other exceptions."""
    generic_error = DockerException("Generic docker error")
    msg = docker_service._format_error_msg(generic_error)
    assert msg == "Generic docker error"
