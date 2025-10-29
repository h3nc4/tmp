#!/bin/sh
#
# Copyright (C) 2025  Henrique Almeida
# This file is part of WASudoku.
#
# WASudoku is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# WASudoku is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with WASudoku.  If not, see <https://www.gnu.org/licenses/>.

set -e

dev_tools="cargo-llvm-cov 0.6.21
cargo-audit 0.21.2"

tools="wasm-pack 0.13.1
wasm-opt 0.116.1"

while getopts "d" opt; do
  case "${opt}" in
  d)
    tools="${tools}
${dev_tools}"
    ;;
  *)
    echo "Usage: $0 [-d]
  -d    Include development tools" >&2
    exit 1
    ;;
  esac
done

echo "${tools}" | while read -r name ver; do
  if ! command -v "${name}" >/dev/null 2>&1; then
    echo "installing ${name} ${ver}"
    cargo install "${name}" --version "${ver}" --locked
  fi
done
