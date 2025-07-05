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

###################################################### RUNTIME IMAGE

FROM debian:bookworm AS runtime

########################### ENV VARS

# APT
ENV DEBIAN_FRONTEND=noninteractive
# Locale
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
# Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Pip
ENV PIPX_HOME=/opt/pipx
ENV PIPX_BIN_DIR=/usr/local/bin
ENV PIPX_MAN_DIR=/usr/local/share/man
# Poetry
ENV POETRY_VIRTUALENVS_PATH=/opt/poetry
# Expose poetry packages to pyhton
ENV PYTHONPATH="${POETRY_VIRTUALENVS_PATH}/lib/site-packages"
# Add pipx and poetry executables to path
ENV PATH="${POETRY_VIRTUALENVS_PATH}/bin:${PIPX_BIN_DIR}:${PATH}"

# Runtime user
ARG USER=hookci
ARG UID=1000
ARG GID=1000

########################### APT DEPENDENCIES

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

########################### POETRY INSTALL

# Install poetry via pipx
RUN pipx install poetry

# Install python dependencies via poetry
RUN --mount=type=bind,target=/tmp/pyproject.toml,source=pyproject.toml \
	cd /tmp && poetry install --no-interaction --no-ansi --no-root && \
	ln -s "${POETRY_VIRTUALENVS_PATH}"/*/bin "${POETRY_VIRTUALENVS_PATH}/bin" && \
	ln -s "${POETRY_VIRTUALENVS_PATH}"/*/lib/* "${POETRY_VIRTUALENVS_PATH}/lib"

########################### PLANTUML INSTALL

# Download plantuml and its signature
ADD https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar /opt/plantuml.jar
ADD https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar.asc /opt/plantuml.jar.asc

# Check signatures and setup plantuml
RUN chmod 0644 /opt/plantuml.jar && \
	gpg --keyserver hkps://keyserver.ubuntu.com --recv-keys 019586D44BD80213 && \
	gpg --verify /opt/plantuml.jar.asc /opt/plantuml.jar && \
	printf "%s\nset -e\n%s\n" "#!/bin/sh" "java -jar /opt/plantuml.jar \$@">/usr/local/bin/plantuml && \
	chmod a+rx /usr/local/bin/plantuml

########################### USER CREATION

# Create user based on current user
RUN groupadd --gid "${GID}" "${USER}" && \
	useradd --uid "${UID}" --gid "${GID}" --home-dir "/home/${USER}" --shell /bin/bash --create-home "${USER}"

# Configure doas and "alias" it to sudo
RUN printf "permit nopass nolog keepenv %s as root\n" "${USER}" >/etc/doas.conf && \
	chmod 400 /etc/doas.conf && \
	printf "%s\nset -e\n%s\n" "#!/bin/sh" "doas \$@">/usr/local/bin/sudo && \
	chmod a+rx /usr/local/bin/sudo

########################### CACHE CLEANING

# Clean gpg keys
RUN rm -f /opt/plantuml.jar.asc
# Clean python cache
RUN rm -rf "${HOME}/.cache" "${HOME}/.local" "${PIPX_HOME}/.cache" "${PIPX_HOME}/logs" && \
	find /usr/lib /usr/share /opt -type d -name '__pycache__' -exec rm -r {} +
# Clean apt cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/* 
# Clean gnupg cache
RUN rm -rf "${HOME}/.gnupg"
# Clean generic cache
RUN rm -rf /var/cache/* /var/log/* /tmp/*

###################################################### LAYER SQUASHING

FROM scratch
COPY --from=runtime / /

########################### ENV VARS

# Locale
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
# Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Pip
ENV PIPX_HOME=/opt/pipx
ENV PIPX_BIN_DIR=/usr/local/bin
ENV PIPX_MAN_DIR=/usr/local/share/man
# Poetry
ENV POETRY_VIRTUALENVS_PATH=/opt/poetry
# Expose poetry packages to pyhton
ENV PYTHONPATH="${POETRY_VIRTUALENVS_PATH}/lib/site-packages"
# Add pipx and poetry executables to path
ENV PATH="${POETRY_VIRTUALENVS_PATH}/bin:${PIPX_BIN_DIR}:${PATH}"

# Change into runtime user
ARG USER=hookci
USER "${USER}"
ENV USER="${USER}"
