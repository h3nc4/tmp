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
# A Dockerfile to build a CI container for WASudoku.

########################################
# Rust versions
ARG RUST_VERSION="1.90.0"
ARG RUST_DISTRO="rust-${RUST_VERSION}-x86_64-unknown-linux-gnu"
ARG RUST_DISTRO_WASM="rust-std-${RUST_VERSION}-wasm32-unknown-unknown"
ARG RUST_DISTRO_SRC="rust-src-${RUST_VERSION}"
ARG CARGO_HOME="/opt/rust/.cargo"

########################################
# Node.js versions
ARG NODE_VERSION="22.20.0"
ARG NODE_DISTRO="node-v${NODE_VERSION}-linux-x64"

################################################################################
# Shared debian image
FROM debian:trixie-slim AS debian-base

# Update apt lists
RUN apt-get update -qq

RUN apt-get install --no-install-recommends -y -qq \
  build-essential \
  ca-certificates \
  pkg-config \
  libssl-dev \
  zlib1g-dev

################################################################################
# Shared builder image
FROM debian:trixie-slim AS builder-base

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
#  Merge all Rust components
FROM builder-base AS rust-stage

# Copy components from each stage
COPY --from=rust-toolchain "/rootfs/" "/rootfs/"
COPY --from=rust-wasm "/rootfs/" "/rootfs/"

# Symlink binaries into PATH
RUN mkdir -p "/rootfs/usr/local/bin"
RUN cd "/rootfs/usr/local/bin" && ln -s ../../../opt/rust/bin/* .

################################################################################
# stage to install cargo dependencies
FROM debian-base AS cargo-deps-stage
ARG CARGO_HOME
ENV CARGO_HOME="/rootfs/${CARGO_HOME}"

COPY --from=rust-stage /rootfs/ /

# Install build dependencies
COPY scripts/wasm-deps.sh /usr/local/bin/wasm-deps
RUN chmod +x /usr/local/bin/wasm-deps
RUN wasm-deps

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
FROM debian-base AS main

# Clean cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*
RUN rm -rf /var/cache/* /var/log/* /tmp/*

################################################################################
# Final squash-and-load image.
FROM scratch AS final
ARG CARGO_HOME
ENV PATH="/wasudoku/node_modules/.bin:${CARGO_HOME}/bin:${PATH}"

COPY --from=main / /
COPY --from=node-stage /rootfs/ /
COPY --from=rust-stage /rootfs/ /
COPY --from=cargo-deps-stage /rootfs/ /

WORKDIR /usr/src/
