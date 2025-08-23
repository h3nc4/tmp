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

################################## FROM ARGUMENTS
# The below variable skips squashing the image layers
# Devcontainers do not support squashing
ARG DEVCONTAINER

################################## POETRY BUILDER
FROM debian:trixie AS poetry-builder
ENV PIPX_HOME=/opt/pipx
ENV PIPX_BIN_DIR=/opt/pipx/bin
ENV POETRY_VIRTUALENVS_PATH=/opt/poetry
ENV PYTHONPATH="${POETRY_VIRTUALENVS_PATH}/lib/site-packages"

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y -qq pipx

RUN pipx install poetry

# Install python dependencies via poetry
COPY pyproject.toml poetry.lock /tmp/
RUN cd /tmp && /opt/pipx/bin/poetry install --no-interaction --no-ansi --no-root && \
    ln -s "${POETRY_VIRTUALENVS_PATH}"/*/bin "${POETRY_VIRTUALENVS_PATH}/bin" && \
    ln -s "${POETRY_VIRTUALENVS_PATH}"/*/lib/* "${POETRY_VIRTUALENVS_PATH}/lib"

# Clear cache
RUN rm -rf /opt/pipx/.cache /opt/pipx/logs && \
    find /opt -type d -name '__pycache__' -exec rm -r {} +

################################## PLANTUML BUILDER
FROM alpine:3.22 AS plantuml-builder

ADD https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar /opt/plantuml.jar
ADD https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar.asc /opt/plantuml.jar.asc

RUN apk add --no-cache gnupg

# Check signatures and setup plantuml
RUN chmod 0644 /opt/plantuml.jar && \
    gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys 019586D44BD80213 && \
    gpg --verify /opt/plantuml.jar.asc /opt/plantuml.jar

################################## RUNTIME IMAGE
FROM debian:trixie AS base

############### ENV VARS
# APT
ENV DEBIAN_FRONTEND=noninteractive
# Locale
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Runtime user
ARG USER=hookci
ARG UID=1000
ARG GID=1000

############### APT DEPENDENCIES

# Update apt lists
RUN apt-get update -qq

# Gen locale
RUN apt-get install --no-install-recommends -y -qq locales && \
    echo "en_US.UTF-8 UTF-8" >/etc/locale.gen && \
    locale-gen en_US.UTF-8 && \
    update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# Install generic tools
RUN apt-get install --no-install-recommends -y -qq \
    bash-completion \
    ca-certificates \
    curl \
    git \
    gnupg \
    less \
    man-db \
    nano \
    opendoas \
    openssh-client \
    procps \
    tree \
    wget

# Install development dependencies
RUN apt-get install --no-install-recommends -y -qq \
    binutils \
    gcc \
    libc-dev \
    make \
    pipx \
    python3-dev

# Install project dependencies
RUN apt-get install --no-install-recommends -y -qq \
    graphviz \
    groff \
    lsof \
    make \
    plantuml \
    shellcheck \
    shfmt \
    strace \
    tmux

########################################
# Install Docker

RUN wget -qO- https://download.docker.com/linux/debian/gpg | gpg --dearmor | tee /etc/apt/keyrings/docker.asc >/dev/null && \
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian trixie stable" \
    | tee /etc/apt/sources.list.d/docker.list >/dev/null && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
    containerd.io \
    docker-buildx-plugin \
    docker-ce \
    docker-ce-cli \
    docker-compose-plugin

############### USER CREATION
# Create user based on current user
RUN groupadd --gid "${GID}" "${USER}" && \
    useradd --uid "${UID}" --gid "${GID}" --home-dir "/home/${USER}" --shell /bin/bash --create-home "${USER}" && \
    usermod -aG docker "${USER}"

# Configure doas and "alias" it to sudo
RUN printf "permit nopass nolog keepenv %s as root\n" "${USER}" >/etc/doas.conf && \
    chmod 400 /etc/doas.conf && \
    printf "%s\nset -e\n%s\n" "#!/bin/sh" "doas \$@">/usr/local/bin/sudo && \
    chmod a+rx /usr/local/bin/sudo

# Configure doas and "alias" it to sudo
RUN printf "permit nopass nolog keepenv %s as root\n" "${USER}" >/etc/doas.conf && \
    chmod 400 /etc/doas.conf && \
    printf "%s\nset -e\n%s\n" "#!/bin/sh" "doas \$@">/usr/local/bin/sudo && \
    chmod a+rx /usr/local/bin/sudo

############### PLANTUML
RUN printf "%s\nset -e\n%s\n" "#!/bin/sh" "java -jar /opt/plantuml.jar \$@" >/usr/local/bin/plantuml && \
    chmod a+rx /usr/local/bin/plantuml
COPY --from=plantuml-builder --chown="${UID}:${GID}" /opt/plantuml.jar /opt/plantuml.jar

############### PYTHON ENVIRONMENT
COPY --from=poetry-builder --chown="${UID}:${GID}" /opt/poetry /opt/poetry
COPY --from=poetry-builder --chown="${UID}:${GID}" /opt/pipx /opt/pipx

############### CACHE CLEANING
# Clean apt cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/* 
# Clean generic cache
RUN rm -rf /var/cache/* /var/log/* /tmp/*
################################## LAYER SQUASHING
FROM scratch AS squash
COPY --from=base / /

FROM ${DEVCONTAINER:-squash}

############### ENV VARS
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

ENV POETRY_VIRTUALENVS_PATH=/opt/poetry

ENV PYTHONPATH="${POETRY_VIRTUALENVS_PATH}/lib/site-packages"
ENV PATH="${POETRY_VIRTUALENVS_PATH}/bin:/opt/pipx/bin:${PATH}"

# Change into runtime user
ARG USER=hookci
ENV USER="${USER}"
USER "${USER}"
