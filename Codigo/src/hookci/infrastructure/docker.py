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
from pathlib import Path
from typing import Dict, Generator, Optional, Protocol

import docker
from docker.errors import APIError, BuildError, DockerException, ImageNotFound
from docker.models.containers import Container

from hookci.infrastructure import constants
from hookci.infrastructure.errors import DockerError
from hookci.log import get_logger

logger = get_logger(__name__)


class IDockerService(Protocol):
    """Interface for Docker operations."""

    def run_command_in_container(
        self,
        image: str,
        command: str,
        workdir: Path,
        env: Optional[Dict[str, str]] = None,
    ) -> Generator[str, None, int]: ...

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

    def run_command_in_container(
        self,
        image: str,
        command: str,
        workdir: Path,
        env: Optional[Dict[str, str]] = None,
    ) -> Generator[str, None, int]:
        """
        Runs a command in a new Docker container, yielding logs in real-time.
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

            for log_line in container.logs(stream=True, follow=True):
                yield log_line.decode("utf-8", errors="ignore")

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
