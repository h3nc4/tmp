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
Tests for the domain configuration models.
"""
import pytest

from hookci.domain.config import (
    Configuration,
    Docker,
    Hooks,
    Step,
    create_default_config,
)


def test_create_default_config() -> None:
    """
    Verify that the default configuration factory creates a valid and expected object.
    """
    config = create_default_config()

    assert isinstance(config, Configuration)
    assert config.version == "1.0"
    assert config.log_level == "INFO"

    assert isinstance(config.docker, Docker)
    assert config.docker.image == "python:3.13-slim-trixie"

    assert isinstance(config.hooks, Hooks)
    assert config.hooks.pre_commit is True
    assert config.hooks.pre_push is True

    assert isinstance(config.steps, list)
    assert len(config.steps) == 2
    assert isinstance(config.steps[0], Step)
    assert config.steps[0].name == "Linting"
    assert config.steps[0].command == "echo 'Linting...'"
    assert config.steps[1].name == "Testing"
    assert config.steps[1].command == "echo 'Testing...'"


def test_configuration_with_default_docker() -> None:
    """
    Verify that Configuration model instantiates with a default docker config
    if none is provided.
    """
    config = Configuration(version="1.0")
    assert config.docker is not None
    assert config.docker.image == "python:3.13-slim-trixie"
    assert config.docker.dockerfile is None


def test_docker_model_validation() -> None:
    """
    Verify that the Docker model validator works correctly.
    """
    assert Docker(image="my-image")
    assert Docker(dockerfile="Dockerfile")

    with pytest.raises(ValueError, match="not both"):
        Docker(image="my-image", dockerfile="Dockerfile")

    with pytest.raises(ValueError, match="must be provided"):
        Docker()
