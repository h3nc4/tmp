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
ARG PYTHON_VERSION=3.13

###################################################### RUNTIME IMAGE
FROM python:${PYTHON_VERSION} AS base

########################### ENV VARS
# Python
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

########################### APT DEPENDENCIES

# Update apt lists
RUN apt-get update -qq

# Install build dependencies via apt
RUN DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y -qq \
    binutils \
    make

############### INSTALL POETRY
RUN python -m pip install --upgrade pip poetry

# Install python dependencies via poetry
COPY pyproject.toml poetry.lock /tmp/
RUN cd /tmp && poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi --only main --no-root

############### CACHE CLEANING
# Clean apt cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/* 
# Clean generic cache
RUN rm -rf /var/cache/* /var/log/* /usr/share/doc*/* /tmp/*

###################################################### LAYER SQUASHING

FROM scratch
COPY --from=base / /
