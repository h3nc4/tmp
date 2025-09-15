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
from typing import Dict, Generator, Literal, Optional, Protocol, Tuple

import docker
from docker.errors import APIError, BuildError, DockerException, ImageNotFound
from docker.models.containers import Container

from hookci.infrastructure import constants
from hookci.infrastructure.errors import DockerError
from hookci.log import get_logger

logger = get_logger(__name__)

LogStream = Literal["stdout", "stderr"]


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

    def _demultiplex_docker_stream(
        self, stream_generator: Generator[bytes, None, None]
    ) -> Generator[Tuple[LogStream, str], None, None]:
        """
        Parses a raw Docker log stream, demultiplexing stdout and stderr.
        This handles streams that may chunk data arbitrarily.
        """
        buffer = b""
        while True:
            try:
                # Read from the generator until it's exhausted
                chunk = next(stream_generator)
                buffer += chunk
            except StopIteration:
                # If there's anything left in the buffer, it's likely an incomplete message.
                # Treat it as stdout as a fallback.
                if buffer:
                    yield "stdout", buffer.decode("utf-8", errors="ignore")
                break  # Exit the main loop

            # Process as many complete frames as we have in the buffer
            while len(buffer) >= 8:
                header = buffer[:8]
                try:
                    stream_type, length = struct.unpack(">BxxxL", header)
                except struct.error:
                    # This indicates a malformed stream. Treat the rest of the buffer as stdout.
                    if buffer:
                        yield "stdout", buffer.decode("utf-8", errors="ignore")
                    buffer = b""  # Clear buffer to prevent reprocessing
                    break  # Exit inner loop

                # Check if the full message is in the buffer
                if len(buffer) >= 8 + length:
                    # Extract the message content
                    content = buffer[8 : 8 + length]
                    # Move the buffer past the message we just processed
                    buffer = buffer[8 + length :]

                    # Stream type 2 is stderr, everything else is stdout
                    stream_name: LogStream = "stderr" if stream_type == 2 else "stdout"
                    yield stream_name, content.decode("utf-8", errors="ignore")
                else:
                    # We don't have the full message yet, break the inner loop
                    # and wait for more chunks from the stream_generator.
                    break

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
