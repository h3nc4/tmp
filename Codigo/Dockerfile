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

ARG PYTHON_VERSION=3.13

ARG NODE_VERSION="22.20.0"
ARG NODE_DISTRO="node-v${NODE_VERSION}-linux-x64"

################################################################################
# Node.js stage
FROM alpine:3.22 AS node-stage
ARG NODE_VERSION
ARG NODE_DISTRO

RUN apk add gnupg tar xz

########################################
# Download and verify Node.js
ADD "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt.asc" /tmp/
ADD "https://github.com/nodejs/release-keys/raw/HEAD/gpg/pubring.kbx" /tmp/node-keyring.kbx
ADD "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DISTRO}.tar.xz" /tmp/

RUN gpg --batch --yes --no-default-keyring --keyring /tmp/node-keyring.kbx \
    --trust-model always --decrypt /tmp/SHASUMS256.txt.asc >/tmp/SHASUMS256.txt && \
    cd /tmp && grep "${NODE_DISTRO}.tar.xz" SHASUMS256.txt | sha256sum -c -

########################################
# Install Node.js to /opt/node
RUN mkdir -p "/rootfs/opt/node" "/rootfs/usr/local/bin" && \
    tar -xf "/tmp/${NODE_DISTRO}.tar.xz" -C "/rootfs/opt/node" --strip-components=1

# Symlink node binaries to /usr/local/bin
RUN cd "/rootfs/usr/local/bin" && ln -s ../../../opt/node/bin/* .

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
FROM python:${PYTHON_VERSION}-slim-trixie AS base

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

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

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
    iputils-ping \
    iproute2 \
    jq \
    less \
    man-db \
    nano \
    net-tools \
    opendoas \
    openssh-client \
    procps \
    tree \
    wget \
    yq

# Install development dependencies
RUN apt-get install --no-install-recommends -y -qq \
    binutils \
    gcc \
    libc-dev \
    make

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
    apt-get install --no-install-recommends -y \
    containerd.io \
    docker-buildx-plugin \
    docker-ce \
    docker-ce-cli \
    docker-compose-plugin

############### INSTALL POETRY
RUN python -m pip install --upgrade pip poetry

# Install python dependencies via poetry
COPY pyproject.toml poetry.lock /tmp/
RUN cd /tmp && poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi --no-root

############### USER CREATION
# Create user based on current user
RUN groupadd --gid "${GID}" "${USER}" && \
    useradd --uid "${UID}" --gid "${GID}" --home-dir "/home/${USER}" --shell /bin/bash --create-home "${USER}" && \
    usermod -aG docker "${USER}"

# Configure doas and alias it to sudo
RUN printf "permit nopass nolog keepenv %s as root\n" "${USER}" >/etc/doas.conf && \
    chmod 400 /etc/doas.conf && \
    printf "%s\nset -e\n%s\n" "#!/bin/sh" "doas \$@" >/usr/local/bin/sudo && \
    chmod a+rx /usr/local/bin/sudo

############### PLANTUML
RUN printf "%s\nset -e\n%s\n" "#!/bin/sh" "java -jar /opt/plantuml.jar \$@" >/usr/local/bin/plantuml && \
    chmod a+rx /usr/local/bin/plantuml
COPY --from=plantuml-builder /opt/plantuml.jar /opt/plantuml.jar

############### CACHE CLEANING
# Clean apt cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/* 
# Clean generic cache
RUN rm -rf /var/cache/* /var/log/* /tmp/*

################################## LAYER SQUASHING
FROM ${DEVCONTAINER:-squash}

COPY --from=base / /
COPY --from=node-stage /rootfs/ /

############### FINAL ENV
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Change into runtime user
ARG USER=hookci
ENV USER="${USER}"
USER "${USER}"
