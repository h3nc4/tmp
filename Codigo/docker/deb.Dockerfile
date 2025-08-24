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

FROM debian:trixie-slim AS base

########################### APT DEPENDENCIES

# Update apt lists
RUN apt-get update -qq

# Install .deb build dependencies via apt
RUN DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y -qq \
    build-essential \
    debhelper \
    fakeroot

############### CACHE CLEANING
# Clean apt cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/* 
# Clean generic cache
RUN rm -rf /var/cache/* /var/log/* /usr/share/doc*/* /tmp/*

###################################################### LAYER SQUASHING

FROM scratch
COPY --from=base / /
