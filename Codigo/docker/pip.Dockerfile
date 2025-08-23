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

###################################################### BUILD IMAGE

FROM debian:bookworm-slim AS poetry-builder

########################### ENV VARS

# Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Pipx
ENV PIPX_HOME=/opt/pipx
ENV PIPX_BIN_DIR=/usr/local/bin
ENV PIPX_MAN_DIR=/tmp/doc
# Poetry
ENV POETRY_VIRTUALENVS_PATH=/opt/poetry
# Add pipx executables to path
ENV PATH="${PIPX_BIN_DIR}:${PATH}"

########################### APT DEPENDENCIES

# Update apt lists
RUN apt-get update -qq

# Install pipx via apt
RUN DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y -qq pipx

########################### POETRY INSTALL

# Install poetry via pipx
RUN pipx install poetry

# Install python dependencies via poetry
RUN --mount=type=bind,target=/tmp/pyproject.toml,source=pyproject.toml \
    cd /tmp && poetry install --no-interaction --no-ansi --only main --no-root && \
    ln -s "${POETRY_VIRTUALENVS_PATH}"/*/bin "${POETRY_VIRTUALENVS_PATH}/bin" && \
    ln -s "${POETRY_VIRTUALENVS_PATH}"/*/lib/* "${POETRY_VIRTUALENVS_PATH}/lib"

###################################################### RUNTIME IMAGE

FROM debian:bookworm-slim AS runtime

########################### ENV VARS

# Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Poetry
ENV POETRY_VIRTUALENVS_PATH=/opt/poetry
# Expose poetry packages to pyhton
ENV PYTHONPATH="${POETRY_VIRTUALENVS_PATH}/lib/site-packages"
# Add poetry executables to path
ENV PATH="${POETRY_VIRTUALENVS_PATH}/bin:${PATH}"

########################### APT DEPENDENCIES

# Update apt lists
RUN apt-get update -qq

# Install build dependencies via apt
RUN DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y -qq \
    binutils \
    make \
    python3-dev

########################### POETRY INSTALL

# Install python dependencies from build container
COPY --from=poetry-builder ${POETRY_VIRTUALENVS_PATH} ${POETRY_VIRTUALENVS_PATH}

########################### CACHE CLEANING

# Clean python cache
RUN rm -rf "${HOME}/.cache" "${PIPX_HOME}/.cache" "${PIPX_HOME}/logs" "${PIPX_MAN_DIR}" && \
    find /usr/lib /usr/share /opt -type d -name '__pycache__' -exec rm -r {} +
# Clean apt cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/* 
# Clean generic cache
RUN rm -rf /var/cache/* /var/log/* /usr/share/doc*/* /tmp/*

###################################################### LAYER SQUASHING

FROM scratch
COPY --from=runtime / /

# Poetry
ENV POETRY_VIRTUALENVS_PATH=/opt/poetry
# Expose poetry packages to pyhton
ENV PYTHONPATH="${POETRY_VIRTUALENVS_PATH}/lib/site-packages"
# Add poetry executables to path
ENV PATH="${POETRY_VIRTUALENVS_PATH}/bin:${PATH}"
