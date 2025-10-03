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
Docker interaction services.
"""
import struct
from pathlib import Path
from typing import Dict, Generator, Optional, Protocol, Tuple, runtime_checkable

import docker
from docker.errors import APIError, BuildError, DockerException, ImageNotFound
from docker.models.containers import Container

from hookci.application.events import LogStream
from hookci.infrastructure import constants
from hookci.infrastructure.errors import DockerError
from hookci.log import get_logger

logger = get_logger(__name__)


@runtime_checkable
class IDockerService(Protocol):
    """Interface for Docker operations."""

    def run_command_in_container(
        self,
        image: str,
        command: str,
        workdir: Path,
        env: Optional[Dict[str, str]] = None,
    ) -> Generator[Tuple[LogStream, str], None, int]: ...

    def build_image(
        self, dockerfile_path: Path, tag: str
    ) -> Generator[str, None, None]: ...

    def start_persistent_container(self, image: str, workdir: Path) -> str: ...

    def exec_in_container(
        self,
        container_id: str,
        command: str,
        env: Optional[Dict[str, str]] = None,
    ) -> Generator[Tuple[LogStream, str], None, int]: ...

    def stop_and_remove_container(self, container_id: str) -> None: ...


class DockerService(IDockerService):
    """Concrete implementation for Docker operations using docker-py."""

    def __init__(self) -> None:
        try:
            self.client = docker.from_env()  # type: ignore[attr-defined, no-untyped-call]
            self.client.ping()
        except DockerException as e:
            raise DockerError(
                "Could not connect to the Docker daemon. Is it running?"
            ) from e

    def _parse_one_frame(
        self, buffer: bytes
    ) -> tuple[tuple[LogStream, str] | None, bytes]:
        """
        Tries to parse a single Docker log frame from the buffer.

        Returns:
            A tuple containing:
            - The parsed (stream, content) tuple, or None if a full frame is not available.
            - The remaining unparsed portion of the buffer.
        """
        if len(buffer) < 8:
            # Not enough data for a header, but if the stream ends here,
            # this might be a final unterminated log line. The demultiplexer handles that.
            return None, buffer

        try:
            stream_type, length = struct.unpack(">BxxxL", buffer[:8])
        except struct.error:
            # Malformed header. Treat the entire buffer as a single stdout message and clear it.
            content = buffer.decode("utf-8", errors="ignore")
            return ("stdout", content), b""

        if len(buffer) < 8 + length:
            return None, buffer  # Not enough data for the full payload

        # Full frame is available
        content_bytes = buffer[8 : 8 + length]
        remaining_buffer = buffer[8 + length :]

        stream: LogStream = "stderr" if stream_type == 2 else "stdout"
        content = content_bytes.decode("utf-8", errors="ignore")

        return (stream, content), remaining_buffer

    def _demultiplex_docker_stream(
        self, stream_generator: Generator[bytes, None, None]
    ) -> Generator[Tuple[LogStream, str], None, None]:
        """
        Parses a raw Docker log stream by repeatedly processing frames from a buffer.
        """
        buffer = b""
        for chunk in stream_generator:
            buffer += chunk
            while True:
                frame, new_buffer = self._parse_one_frame(buffer)
                buffer = new_buffer
                if frame:
                    yield frame
                else:
                    # No more complete frames in the buffer, need more data.
                    break

        # If any data remains in the buffer after the stream is exhausted,
        # treat it as a final stdout line.
        if buffer:
            yield "stdout", buffer.decode("utf-8", errors="ignore")

    def run_command_in_container(
        self,
        image: str,
        command: str,
        workdir: Path,
        env: Optional[Dict[str, str]] = None,
    ) -> Generator[Tuple[LogStream, str], None, int]:
        """
        Runs a command in a new Docker container, yielding demultiplexed logs.
        Returns the final exit code.
        """
        container: Optional[Container] = None
        try:
            logger.debug(f"Running command in container using image {image}...")
            container = self.client.containers.run(
                image=image,
                command=["/bin/sh", "-c", command],
                volumes={
                    str(workdir): {
                        "bind": constants.CONTAINER_WORKDIR,
                        "mode": "rw",
                    }
                },
                working_dir=constants.CONTAINER_WORKDIR,
                environment=env or {},
                detach=True,
            )

            # Get the raw, multiplexed stream by removing the incorrect 'demux' argument.
            # The default behavior for a non-TTY stream is the format we handle.
            log_stream_generator = container.logs(
                stream=True, follow=True, stdout=True, stderr=True
            )
            yield from self._demultiplex_docker_stream(log_stream_generator)

            result = container.wait()
            return int(result.get("StatusCode", 1))

        except ImageNotFound:
            raise DockerError(f"Docker image '{image}' not found.")
        except APIError as e:
            raise DockerError(f"Docker API error: {e.explanation}") from e
        finally:
            if container:
                container.remove(force=True)  # type: ignore[no-untyped-call]

    def build_image(
        self, dockerfile_path: Path, tag: str
    ) -> Generator[str, None, None]:
        """
        Builds a Docker image from a Dockerfile, yielding logs in real-time.
        """
        logger.debug(
            f"Building Docker image from '{dockerfile_path.name}' with tag {tag}..."
        )
        dockerfile_dir = dockerfile_path.parent
        try:
            _, build_logs = self.client.images.build(
                path=str(dockerfile_dir),
                dockerfile=str(dockerfile_path.name),
                tag=tag,
                rm=True,
            )
            for chunk in build_logs:
                if "stream" in chunk:
                    yield chunk["stream"]
                elif "error" in chunk:
                    raise DockerError(f"Failed to build Docker image: {chunk['error']}")

        except BuildError as e:
            raise DockerError(f"Failed to build Docker image: {e.msg}") from e
        except APIError as e:
            raise DockerError(f"Docker API error during build: {e.explanation}") from e

    def start_persistent_container(self, image: str, workdir: Path) -> str:
        """
        Starts a container that remains running in the background.
        Returns the container ID.
        """
        try:
            container: Container = self.client.containers.run(
                image=image,
                command=["tail", "-f", "/dev/null"],  # Keep-alive command
                volumes={
                    str(workdir): {
                        "bind": constants.CONTAINER_WORKDIR,
                        "mode": "rw",
                    }
                },
                working_dir=constants.CONTAINER_WORKDIR,
                detach=True,
            )
            return str(container.id)
        except ImageNotFound:
            raise DockerError(f"Docker image '{image}' not found.")
        except APIError as e:
            raise DockerError(f"Docker API error: {e.explanation}") from e

    def exec_in_container(
        self,
        container_id: str,
        command: str,
        env: Optional[Dict[str, str]] = None,
    ) -> Generator[Tuple[LogStream, str], None, int]:
        """
        Executes a command in a running container and yields its logs.
        Returns the command's exit code.
        """
        try:
            container: Container = self.client.containers.get(container_id)

            # Step 1: Create the exec instance using the low-level API
            exec_instance = self.client.api.exec_create(
                container.id, cmd=["/bin/sh", "-c", command], environment=env or {}
            )
            exec_id = exec_instance["Id"]

            # Step 2: Start the exec instance and get the streaming output
            output_stream = self.client.api.exec_start(exec_id, stream=True)

            # Step 3: Yield logs from the demultiplexed stream
            yield from self._demultiplex_docker_stream(output_stream)

            # Step 4: Inspect the exec instance to get the final exit code
            inspect_result = self.client.api.exec_inspect(exec_id)
            exit_code = inspect_result.get("ExitCode")

            if exit_code is None:
                raise DockerError(
                    f"Could not determine exit code for exec command in container {container_id}"
                )
            return int(exit_code)

        except APIError as e:
            raise DockerError(f"Docker API error during exec: {e.explanation}") from e

    def stop_and_remove_container(self, container_id: str) -> None:
        """Stops and removes a container."""
        try:
            container = self.client.containers.get(container_id)
            container.stop(timeout=1)
            container.remove()
        except APIError as e:
            logger.warning(
                f"Could not stop or remove container {container_id}: {e.explanation}"
            )
