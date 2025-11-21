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
from collections import deque
from pathlib import Path
from textwrap import dedent
from typing import Any, Dict, Generator, Literal, Optional, Tuple

from pydantic import ValidationError

from hookci.application import constants
from hookci.application.errors import (
    ConfigurationUpToDateError,
    ProjectAlreadyInitializedError,
)
from hookci.application.events import (
    DebugShellStarting,
    ImageBuildEnd,
    ImageBuildProgress,
    ImageBuildStart,
    ImagePullEnd,
    ImagePullStart,
    LogLine,
    LogStream,
    PipelineEnd,
    PipelineEvent,
    PipelineStart,
    StepEnd,
    StepStart,
)
from hookci.domain.config import Configuration, Docker, Step, create_default_config
from hookci.infrastructure.docker import IDockerService
from hookci.infrastructure.errors import ConfigurationParseError, DockerError
from hookci.infrastructure.fs import IFileSystem, IScmService
from hookci.infrastructure.yaml_handler import IConfigHandler
from hookci.log import get_logger, setup_logging

logger = get_logger(__name__)


class ProjectInitService:
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
        git_service: IScmService,
        fs: IFileSystem,
        config_handler: IConfigHandler,
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

        config_data = default_config.model_dump(exclude_none=True, by_alias=True)
        config_data["log_level"] = default_config.log_level.value
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
        git_service: IScmService,
        config_handler: IConfigHandler,
        docker_service: IDockerService,
    ):
        self._git_service = git_service
        self._config_handler = config_handler
        self._docker_service = docker_service

    def run(
        self, hook_type: Optional[str], debug: bool = False
    ) -> Generator[PipelineEvent, None, None]:
        """
        Executes the main CI pipeline, yielding events for real-time feedback.
        """
        config = self._load_and_validate_configuration()
        setup_logging(config.log_level.value)

        if not self._should_run(hook_type, config):
            return

        if debug and hook_type:
            logger.warning(
                "Debug mode is enabled, but it is not supported for git hook runs. "
                "The pipeline will run in standard mode."
            )
            debug = False

        if debug:
            yield from self._run_pipeline_debug(config)
        else:
            yield from self._run_pipeline_standard(config)

    def _run_pipeline_standard(
        self, config: Configuration
    ) -> Generator[PipelineEvent, None, None]:
        yield PipelineStart(total_steps=len(config.steps), log_level=config.log_level)

        docker_image = yield from self._prepare_docker_image(config)
        if not docker_image:
            yield PipelineEnd(status="FAILURE")
            return

        final_status: Literal["SUCCESS", "FAILURE", "WARNING"] = "SUCCESS"
        for step in config.steps:
            yield StepStart(step=step)

            try:
                exit_code = yield from self._execute_step(
                    step, docker_image, self._git_service.git_root
                )
            except DockerError as e:
                logger.error(f"Infrastructure error during step '{step.name}': {e}")
                yield StepEnd(step=step, status="FAILURE", exit_code=1)
                yield PipelineEnd(status="FAILURE")
                return

            if exit_code == 0:
                yield StepEnd(step=step, status="SUCCESS", exit_code=exit_code)
            else:
                if step.critical:
                    yield StepEnd(step=step, status="FAILURE", exit_code=exit_code)
                    final_status = "FAILURE"
                    break
                else:
                    if final_status != "FAILURE":
                        final_status = "WARNING"
                    yield StepEnd(step=step, status="WARNING", exit_code=exit_code)

        yield PipelineEnd(status=final_status)

    def _run_pipeline_debug(
        self, config: Configuration
    ) -> Generator[PipelineEvent, None, None]:
        yield PipelineStart(total_steps=len(config.steps), log_level=config.log_level)

        docker_image = yield from self._prepare_docker_image(config)
        if not docker_image:
            yield PipelineEnd(status="FAILURE")
            return

        try:
            container_id = self._docker_service.start_persistent_container(
                image=docker_image, workdir=self._git_service.git_root
            )
        except DockerError as e:
            logger.error(f"Failed to start debug container: {e}")
            yield PipelineEnd(status="FAILURE")
            return

        logger.debug(f"Started persistent container: {container_id}")

        final_status: Literal["SUCCESS", "FAILURE", "WARNING"] = "SUCCESS"
        try:
            for step in config.steps:
                yield StepStart(step=step)

                try:
                    exit_code = yield from self._stream_logs_and_get_exit_code(
                        self._docker_service.exec_in_container(
                            container_id, command=step.command, env=step.env
                        ),
                        step.name,
                    )
                except DockerError as e:
                    logger.error(
                        f"Infrastructure error during debug step '{step.name}': {e}"
                    )
                    yield StepEnd(step=step, status="FAILURE", exit_code=1)
                    final_status = "FAILURE"
                    break

                if exit_code == 0:
                    yield StepEnd(step=step, status="SUCCESS", exit_code=exit_code)
                    continue
                if step.critical:
                    yield StepEnd(step=step, status="FAILURE", exit_code=exit_code)
                    yield DebugShellStarting(step=step, container_id=container_id)
                    final_status = "FAILURE"
                    break
                if final_status != "FAILURE":
                    final_status = "WARNING"
                yield StepEnd(step=step, status="WARNING", exit_code=exit_code)

        finally:
            logger.debug(f"Stopping and removing container: {container_id}")
            self._docker_service.stop_and_remove_container(container_id)

        yield PipelineEnd(status=final_status)

    def _stream_logs_and_get_exit_code(
        self,
        log_generator: Generator[Tuple[LogStream, str], None, int],
        step_name: str,
    ) -> Generator[LogLine, None, int]:
        """Consumes a log generator, yields LogLine events, and returns the exit code."""
        exit_code = 1
        try:
            while True:
                stream, log_line = next(log_generator)
                yield LogLine(line=log_line, stream=stream, step_name=step_name)
        except StopIteration as e:
            exit_code = e.value if e.value is not None else 1
        return int(exit_code)

    def _execute_step(
        self, step: Step, image: str, workdir: Path
    ) -> Generator[PipelineEvent, None, int]:
        """Runs a single step in a transient container and returns the exit code."""
        command_gen = self._docker_service.run_command_in_container(
            image=image,
            command=step.command,
            workdir=workdir,
            env=step.env,
        )
        exit_code = yield from self._stream_logs_and_get_exit_code(
            command_gen, step.name
        )
        return exit_code

    def _is_hook_enabled(self, hook_type: str, config: Configuration) -> bool:
        """Checks if the specific Git hook is enabled in the configuration."""
        if hook_type == "pre-commit" and not config.hooks.pre_commit:
            logger.info("Skipping: pre-commit hook is disabled in the configuration.")
            return False

        if hook_type == "pre-push" and not config.hooks.pre_push:
            logger.info("Skipping: pre-push hook is disabled in the configuration.")
            return False

        return True

    def _passes_filters(self, hook_type: str, config: Configuration) -> bool:
        """Checks if the current Git state passes the configured filters."""
        if not config.filters:
            return True

        if config.filters.branches:
            current_branch = self._git_service.get_current_branch()
            if not re.match(config.filters.branches, current_branch):
                logger.info(
                    f"Skipping: current branch '{current_branch}' does not match "
                    f"filter '{config.filters.branches}'."
                )
                return False

        if hook_type == "pre-commit" and config.filters.commits:
            commit_message = self._git_service.get_staged_commit_message()
            if not re.match(config.filters.commits, commit_message, re.DOTALL):
                logger.info(
                    "Skipping: commit message does not match "
                    f"filter '{config.filters.commits}'."
                )
                return False

        return True

    def _should_run(self, hook_type: Optional[str], config: Configuration) -> bool:
        """Determines if the pipeline should run based on context and config."""
        if not hook_type:
            logger.debug("Manual run triggered. Skipping checks.")
            return True

        if not self._is_hook_enabled(hook_type, config):
            return False

        if not self._passes_filters(hook_type, config):
            return False

        logger.debug(f"Checks passed for '{hook_type}' hook. Proceeding with run.")
        return True

    def _prepare_docker_image(
        self, config: Configuration
    ) -> Generator[PipelineEvent, None, str | None]:
        """
        Ensures the required Docker image is available, either by pulling,
        building it, or using a cached version.
        """
        if config.docker.dockerfile:
            return (yield from self._prepare_from_dockerfile(config.docker.dockerfile))

        if config.docker.image:
            return (yield from self._prepare_from_registry(config.docker.image))

        # This case should be prevented by pydantic model validation, but as a safeguard:
        raise ConfigurationParseError("No docker image or dockerfile was specified.")

    def _prepare_from_dockerfile(
        self, dockerfile_rel_path: str
    ) -> Generator[PipelineEvent, None, str | None]:
        """Handles building a Docker image from a Dockerfile."""
        git_root = self._git_service.git_root
        dockerfile_path = git_root / dockerfile_rel_path

        try:
            dockerfile_hash = self._docker_service.calculate_dockerfile_hash(
                dockerfile_path
            )
            tag = f"hookci/{git_root.name}:{dockerfile_hash}"

            if self._docker_service.image_exists(tag):
                logger.debug(f"Using cached Docker image: {tag}")
                return tag

            total_steps = self._docker_service.count_dockerfile_steps(dockerfile_path)
        except DockerError as e:
            logger.error(f"Docker build preparation failed: {e}")
            return None

        yield ImageBuildStart(
            dockerfile_path=str(dockerfile_path), tag=tag, total_steps=total_steps
        )
        try:
            build_generator = self._docker_service.build_image(dockerfile_path, tag)
            for step, line in build_generator:
                yield ImageBuildProgress(step=step, line=line)
            yield ImageBuildEnd(status="SUCCESS")
            return tag
        except DockerError as e:
            logger.error(f"Docker build failed: {e}")
            yield ImageBuildEnd(status="FAILURE")
            return None

    def _prepare_from_registry(
        self, image_name: str
    ) -> Generator[PipelineEvent, None, str | None]:
        """Handles pulling a Docker image from a registry."""
        try:
            if self._docker_service.image_exists(image_name):
                logger.debug(f"Using cached Docker image: {image_name}")
                return image_name
        except DockerError as e:
            logger.warning(f"Could not check if image exists locally: {e}")

        yield ImagePullStart(image_name=image_name)
        try:
            # Consume the generator
            deque(self._docker_service.pull_image(image_name), maxlen=0)
            yield ImagePullEnd(status="SUCCESS")
            return image_name
        except DockerError as e:
            logger.error(f"Docker pull failed: {e}")
            yield ImagePullEnd(status="FAILURE")
            return None

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


class MigrationService:
    """Service to handle the configuration migration use case."""

    def __init__(
        self,
        git_service: IScmService,
        config_handler: IConfigHandler,
    ):
        self._git_service = git_service
        self._config_handler = config_handler

    def run(self) -> str:
        """
        Executes the configuration migration logic.

        Loads the configuration, transforms it from a legacy format to
        the current format and writes it back.

        Returns:
            A success message.

        Raises:
            ConfigurationUpToDateError: If the configuration is already in the latest format.
            ConfigurationParseError: If the configuration file is malformed.
            ConfigurationNotFoundError: If the configuration file does not exist.
        """
        config_path = (
            self._git_service.git_root
            / constants.BASE_DIR_NAME
            / constants.CONFIG_FILENAME
        )
        raw_config: Dict[str, Any] = self._config_handler.load_config_data(config_path)

        config_version = str(raw_config.get("version", ""))
        if config_version == constants.LATEST_CONFIG_VERSION:
            raise ConfigurationUpToDateError("Configuration is already up-to-date.")

        if config_version:
            logger.info(
                f"Old configuration version '{config_version}' detected. Migrating to v{constants.LATEST_CONFIG_VERSION}..."
            )
        else:
            logger.info(
                f"Unversioned configuration detected. Migrating to v{constants.LATEST_CONFIG_VERSION}..."
            )

        # Create a default config object to serve as a base
        new_config = create_default_config()

        # Migrate top-level docker keys
        if "image" in raw_config or "dockerfile" in raw_config:
            new_config.docker.image = raw_config.get("image")
            new_config.docker.dockerfile = raw_config.get("dockerfile")
            # Ensure the migrated docker config is valid
            try:
                # Pydantic will run the validator when creating a new Docker object
                new_config.docker = Docker.model_validate(
                    new_config.docker.model_dump()
                )
            except ValueError as e:
                raise ConfigurationParseError(
                    f"Invalid legacy docker configuration: {e}"
                ) from e

        # Migrate simple list of steps
        raw_steps = raw_config.get("steps", [])
        if raw_steps and isinstance(raw_steps[0], str):
            new_config.steps = [
                Step(name=f"Step {i+1}", command=cmd) for i, cmd in enumerate(raw_steps)
            ]
        elif raw_steps:
            # If steps are not simple strings, assume they might be in the new format already but
            # the top-level version key was missing. We just try to validate them.
            try:
                new_config.steps = [Step.model_validate(s) for s in raw_steps]
            except ValidationError as e:
                raise ConfigurationParseError(
                    f"Could not parse 'steps' during migration: {e}"
                ) from e

        # Convert the Pydantic model back to a dict for writing
        migrated_data = new_config.model_dump(exclude_none=True, by_alias=True)
        migrated_data["log_level"] = new_config.log_level.value

        self._config_handler.write_config_data(config_path, migrated_data)

        return "Configuration successfully migrated to the latest version."
