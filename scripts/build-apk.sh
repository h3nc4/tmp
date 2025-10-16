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

# Called by CI to build the Android APK using Bubblewrap.
docker run \
  --rm \
  --entrypoint sh \
  -e "BUBBLEWRAP_KEYSTORE_PASSWORD=${KEYSTORE_PASSWORD}" \
  -e "BUBBLEWRAP_KEY_PASSWORD=${KEYSTORE_PASSWORD}" \
  -e "VERSION=${1#v}" \
  -v "$(pwd)":/app \
  ghcr.io/googlechromelabs/bubblewrap:latest \
  -c 'printf "%s\n" "${VERSION}" | bubblewrap update && yes | bubblewrap build'
