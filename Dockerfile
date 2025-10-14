# Copyright (C) 2025  Henrique Almeida
# This file is part of WASudoku.

# WASudoku is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# WASudoku is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.

# You should have received a copy of the GNU Affero General Public License
# along with WASudoku.  If not, see <https://www.gnu.org/licenses/>.

################################################################################
# A Dockerfile to build a development container for WASudoku.

########################################
# Rust versions
ARG RUST_VERSION="1.90.0"
ARG RUST_DISTRO="rust-${RUST_VERSION}-x86_64-unknown-linux-gnu"
ARG RUST_DISTRO_WASM="rust-std-${RUST_VERSION}-wasm32-unknown-unknown"
ARG RUST_DISTRO_SRC="rust-src-${RUST_VERSION}"

########################################
# Node.js versions
ARG NODE_VERSION="22.20.0"
ARG NODE_DISTRO="node-v${NODE_VERSION}-linux-x64"

########################################
# Runtime user configuration
ARG USER="wasudoku"
ARG UID="1000"
ARG GID="1000"
ARG CARGO_HOME="/home/${USER}/.local/share/cargo"

################################################################################
# Shared builder image
FROM debian:trixie AS builder-base

RUN apt-get update && apt-get install -y --no-install-recommends \
  gnupg \
  tar \
  xz-utils

################################################################################
# Shared Rust image
FROM builder-base AS rust-base

ADD https://static.rust-lang.org/rust-key.gpg.ascii /tmp/rust-key.gpg.ascii

RUN mkdir -p /usr/share/keyrings && \
  gpg --batch --yes --no-default-keyring \
  --keyring /usr/share/keyrings/rust-keyring.gpg \
  --import /tmp/rust-key.gpg.ascii

########################################
# Install toolchain
FROM rust-base AS rust-toolchain
ARG RUST_VERSION
ARG RUST_DISTRO

ADD "https://static.rust-lang.org/dist/${RUST_DISTRO}.tar.xz" /tmp/
ADD "https://static.rust-lang.org/dist/${RUST_DISTRO}.tar.xz.asc" /tmp/

RUN gpg --batch --yes --no-default-keyring --keyring /usr/share/keyrings/rust-keyring.gpg --verify "/tmp/${RUST_DISTRO}.tar.xz.asc" "/tmp/${RUST_DISTRO}.tar.xz" && \
  mkdir -p "/rootfs/opt/rust" "/tmp/rust-installer"
RUN tar -xf "/tmp/${RUST_DISTRO}.tar.xz" -C "/tmp/rust-installer" --strip-components=1 && \
  cd "/tmp/rust-installer" && ./install.sh --prefix="/rootfs/opt/rust"

########################################
# Install wasm32 target
FROM rust-base AS rust-wasm
ARG RUST_VERSION
ARG RUST_DISTRO_WASM

ADD "https://static.rust-lang.org/dist/${RUST_DISTRO_WASM}.tar.xz" /tmp/
ADD "https://static.rust-lang.org/dist/${RUST_DISTRO_WASM}.tar.xz.asc" /tmp/

RUN gpg --batch --yes --no-default-keyring --keyring /usr/share/keyrings/rust-keyring.gpg --verify "/tmp/${RUST_DISTRO_WASM}.tar.xz.asc" "/tmp/${RUST_DISTRO_WASM}.tar.xz" && \
  mkdir -p "/rootfs/opt/rust" "/tmp/rust-installer-wasm"
RUN tar -xf "/tmp/${RUST_DISTRO_WASM}.tar.xz" -C "/tmp/rust-installer-wasm" --strip-components=1 && \
  cd "/tmp/rust-installer-wasm" && ./install.sh --prefix="/rootfs/opt/rust"

########################################
# Install rust source code
FROM rust-base AS rust-src
ARG RUST_VERSION
ARG RUST_DISTRO_SRC

ADD "https://static.rust-lang.org/dist/${RUST_DISTRO_SRC}.tar.xz" /tmp/
ADD "https://static.rust-lang.org/dist/${RUST_DISTRO_SRC}.tar.xz.asc" /tmp/

RUN gpg --batch --yes --no-default-keyring --keyring /usr/share/keyrings/rust-keyring.gpg --verify "/tmp/${RUST_DISTRO_SRC}.tar.xz.asc" "/tmp/${RUST_DISTRO_SRC}.tar.xz" && \
  mkdir -p "/rootfs/opt/rust" "/tmp/rust-installer-src"
RUN tar -xf "/tmp/${RUST_DISTRO_SRC}.tar.xz" -C "/tmp/rust-installer-src" --strip-components=1 && \
  cd "/tmp/rust-installer-src" && ./install.sh --prefix="/rootfs/opt/rust"

########################################
#  Merge all Rust components
FROM builder-base AS rust-stage

# Copy components from each stage
COPY --from=rust-toolchain "/rootfs/" "/rootfs/"
COPY --from=rust-wasm "/rootfs/" "/rootfs/"
COPY --from=rust-src  "/rootfs/" "/rootfs/"

# Symlink binaries into PATH
RUN mkdir -p "/rootfs/usr/local/bin"
RUN cd "/rootfs/usr/local/bin" && ln -s ../../../opt/rust/bin/* .

################################################################################
# Node.js stage
FROM builder-base AS node-stage
ARG NODE_VERSION
ARG NODE_DISTRO

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

################################################################################
# Debian main stage
FROM debian:trixie AS main
ARG USER
ARG UID
ARG GID

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

# Install build tools
RUN apt-get install --no-install-recommends -y -qq \
  build-essential \
  pkg-config \
  libssl-dev \
  zlib1g-dev

# Install debugging tools
RUN apt-get install --no-install-recommends -y -qq \
  lldb

########################################
# Create a non-root developing user and configure doas
RUN addgroup --gid "${GID}" "${USER}"
RUN adduser --uid "${UID}" --gid "${GID}" \
  --shell "/bin/bash" --disabled-password "${USER}"

RUN printf "permit nopass nolog keepenv %s as root\n" "${USER}" >/etc/doas.conf && \
  chmod 400 /etc/doas.conf && \
  printf "%s\nset -e\n%s\n" "#!/bin/sh" "doas \$@" >/usr/local/bin/sudo && \
  chmod a+rx /usr/local/bin/sudo

########################################
# Clean cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*
RUN rm -rf /var/cache/* /var/log/* /tmp/*

################################################################################
# Final squash-and-load image. Change to scratch once https://github.com/devcontainers/cli/issues/239 is resolved.
FROM debian:trixie AS final
ARG USER
ARG RUST_VERSION
ARG CARGO_HOME
ENV USER="${USER}" \
  RUST_VERSION="${RUST_VERSION}" \
  CARGO_HOME="${CARGO_HOME}" \
  PATH="/wasudoku/node_modules/.bin:${CARGO_HOME}/bin:${PATH}" \
  LANG="en_US.UTF-8" \
  LC_ALL="en_US.UTF-8"

COPY --from=main / /
COPY --from=node-stage /rootfs/ /
COPY --from=rust-stage /rootfs/ /

USER "${USER}"
