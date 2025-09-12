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
import re
from pathlib import Path
from textwrap import dedent
from typing import Generator, Literal, Optional

from pydantic import ValidationError

from hookci.application import constants
from hookci.application.errors import ProjectAlreadyInitializedError
from hookci.application.events import (
    ImageBuildEnd,
    ImageBuildStart,
    LogLine,
    PipelineEnd,
    PipelineEvent,
    PipelineStart,
    StepEnd,
    StepStart,
)
from hookci.domain.config import Configuration, create_default_config
from hookci.infrastructure.docker import IDockerService
from hookci.infrastructure.errors import ConfigurationParseError, DockerError
from hookci.infrastructure.fs import IFileSystem, IGitService
from hookci.infrastructure.yaml_handler import IConfigurationHandler
from hookci.log import get_logger, setup_logging

logger = get_logger(__name__)


class ProjectInitializationService:
    """Service to handle the project initialization use case."""

    _HOOKS_DIR_NAME: str = "hooks"
    _PRE_COMMIT_FILENAME: str = "pre-commit"
    _PRE_PUSH_FILENAME: str = "pre-push"

    _PRE_COMMIT_SCRIPT: str = dedent(
        """\
        #!/usr/bin/env sh
        # HookCI pre-commit hook

        exec hookci run --hook-type pre-commit
        """
    )

    _PRE_PUSH_SCRIPT: str = dedent(
        """\
        #!/usr/bin/env sh
        # HookCI pre-push hook

        exec hookci run --hook-type pre-push
        """
    )

    def __init__(
        self,
        git_service: IGitService,
        fs: IFileSystem,
        config_handler: IConfigurationHandler,
    ):
        self._git_service = git_service
        self._fs = fs
        self._config_handler = config_handler

    def run(self) -> Path:
        """
        Executes the project initialization logic.
        """
        git_root = self._git_service.git_root
        base_dir = git_root / constants.BASE_DIR_NAME
        hooks_dir = base_dir / self._HOOKS_DIR_NAME
        config_path = base_dir / constants.CONFIG_FILENAME

        if self._fs.file_exists(config_path):
            raise ProjectAlreadyInitializedError(
                f"Project already initialized. Config file exists: {config_path}"
            )

        self._fs.create_dir(hooks_dir)
        default_config = create_default_config()

        config_data = default_config.model_dump(exclude_none=True)
        self._config_handler.write_config_data(config_path, config_data)

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


class CiExecutionService:
    """Service to handle the CI execution use case."""

    def __init__(
        self,
        git_service: IGitService,
        config_handler: IConfigurationHandler,
        docker_service: IDockerService,
    ):
        self._git_service = git_service
        self._config_handler = config_handler
        self._docker_service = docker_service

    def run(self, hook_type: Optional[str]) -> Generator[PipelineEvent, None, None]:
        """
        Executes the main CI pipeline, yielding events for real-time feedback.
        """
        config = self._load_and_validate_configuration()
        setup_logging(config.log_level)

        if not self._should_run(hook_type, config):
            return

        yield PipelineStart(total_steps=len(config.steps))

        docker_image = yield from self._prepare_docker_image(config)
        if not docker_image:
            yield PipelineEnd(status="FAILURE")
            return

        final_status: Literal["SUCCESS", "FAILURE", "WARNING"] = "SUCCESS"
        for step in config.steps:
            yield StepStart(step=step)

            exit_code = 1  # Default to failure
            command_gen = self._docker_service.run_command_in_container(
                image=docker_image,
                command=step.command,
                workdir=self._git_service.git_root,
                env=step.env,
            )

            try:
                while True:
                    log_line = next(command_gen)
                    yield LogLine(line=log_line)
            except StopIteration as e:
                exit_code = e.value

            if exit_code == 0:
                yield StepEnd(step=step, status="SUCCESS", exit_code=exit_code)
            else:
                if step.critical:
                    yield StepEnd(step=step, status="FAILURE", exit_code=exit_code)
                    final_status = "FAILURE"
                    break
                else:
                    final_status = "WARNING"
                    yield StepEnd(step=step, status="WARNING", exit_code=exit_code)

        yield PipelineEnd(status=final_status)

    def _should_run(self, hook_type: Optional[str], config: Configuration) -> bool:
        """Determines if the pipeline should run based on context and config."""
        if not hook_type:
            logger.debug("Manual run triggered. Skipping checks.")
            return True

        if hook_type == "pre-commit" and not config.hooks.pre_commit:
            logger.info("Skipping: pre-commit hook is disabled in the configuration.")
            return False

        if hook_type == "pre-push" and not config.hooks.pre_push:
            logger.info("Skipping: pre-push hook is disabled in the configuration.")
            return False

        if config.filters and config.filters.branches:
            current_branch = self._git_service.get_current_branch()
            if not re.match(config.filters.branches, current_branch):
                logger.info(
                    f"Skipping: current branch '{current_branch}' does not match "
                    f"filter '{config.filters.branches}'."
                )
                return False

        logger.debug(f"Checks passed for '{hook_type}' hook. Proceeding with run.")
        return True

    def _prepare_docker_image(
        self, config: Configuration
    ) -> Generator[PipelineEvent, None, str | None]:
        """
        Builds image from Dockerfile if specified, otherwise returns image name.
        Yields build events and returns the final image name or None on failure.
        """
        if config.docker.dockerfile:
            git_root = self._git_service.git_root
            tag = f"hookci-project:{git_root.name}"
            dockerfile_path = git_root / config.docker.dockerfile
            yield ImageBuildStart(dockerfile_path=str(dockerfile_path), tag=tag)
            try:
                build_generator = self._docker_service.build_image(dockerfile_path, tag)
                for log_line in build_generator:
                    yield LogLine(line=log_line)
                yield ImageBuildEnd(status="SUCCESS")
                return tag
            except DockerError as e:
                logger.error(f"Docker build failed: {e}")
                yield LogLine(line=str(e))
                yield ImageBuildEnd(status="FAILURE")
                return None

        return config.docker.image

    def _load_and_validate_configuration(self) -> Configuration:
        """
        Locates, loads, and validates the HookCI configuration file.
        """
        config_path = (
            self._git_service.git_root
            / constants.BASE_DIR_NAME
            / constants.CONFIG_FILENAME
        )
        config_data = self._config_handler.load_config_data(config_path)
        try:
            return Configuration.model_validate(config_data)
        except ValidationError as e:
            raise ConfigurationParseError(
                f"Invalid configuration structure:\n{e}"
            ) from e
