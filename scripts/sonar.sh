#!/bin/sh
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

set -e

cd "$(dirname "$0")/../"

SONAR_CONTAINER_NAME="sonarqube"
SONAR_IMAGE="sonarqube:25.9.0.112764-community"
SONAR_SCAN_IMAGE="sonarsource/sonar-scanner-cli:11"
SONAR_URL="http://localhost:9000"
PROJECT_KEY=$(grep 'sonar.projectKey' ./sonar-project.properties | cut -d'=' -f2)

if ! [ -f ./coverage-ui.lcov ] || ! [ -f ./coverage-wasm.xml ]; then
  echo "Coverage report files not found." >&2
  exit 1
fi

# Adjust paths in coverage reports
sed -i "s|<source>/wasudoku|<source>.|" coverage-wasm.xml

# Start pulling scanner image in background
docker pull "${SONAR_SCAN_IMAGE}" >/dev/null 2>&1 &
PULL_PID=$!

if [ ! "$(docker ps -q -f name=${SONAR_CONTAINER_NAME})" ]; then
  if [ "$(docker ps -aq -f status=exited -f name=${SONAR_CONTAINER_NAME})" ]; then
    docker start ${SONAR_CONTAINER_NAME} >/dev/null
  else
    docker run -d \
      --name ${SONAR_CONTAINER_NAME} \
      -p 0.0.0.0:9000:9000 \
      -v sonarqube_data:/opt/sonarqube/data \
      -v sonarqube_extensions:/opt/sonarqube/extensions \
      -v sonarqube_logs:/opt/sonarqube/logs \
      -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
      ${SONAR_IMAGE} >/dev/null
  fi

  echo "Waiting for SonarQube to start..."
  while ! wget -qO- "${SONAR_URL}/api/system/status" 2>/dev/null | grep -q 'UP'; do
    sleep 1
  done
  # Configure SonarQube to allow anonymous access
  if ! curl -s -u admin:admin "${SONAR_URL}/api/settings/values?keys=sonar.forceAuthentication" | grep -q '"value":"false"'; then
    curl -su admin:admin -X POST "${SONAR_URL}/api/settings/set?key=sonar.forceAuthentication&value=false"
    curl -su admin:admin -X POST "${SONAR_URL}/api/permissions/add_group?permission=provisioning&groupName=anyone"
    curl -su admin:admin -X POST "${SONAR_URL}/api/permissions/add_group?permission=scan&groupName=anyone"
  fi
fi

echo "Running SonarQube analysis..."
wait $PULL_PID
docker run \
  --rm \
  --network="host" \
  -v "${PWD}/:/usr/src" \
  "${SONAR_SCAN_IMAGE}" \
  -Dsonar.host.url="${SONAR_URL}"

sleep 15
if ! curl -s "${SONAR_URL}/api/issues/search?componentKeys=${PROJECT_KEY}&resolved=false&ps=1" | grep -q '{"total":0,' &&
  ! curl -s "${SONAR_URL}/api/measures/component?component=${PROJECT_KEY}&metricKeys=coverage" | grep -q '"coverage","value":"100.0"'; then
  echo "ERROR: SonarQube analysis failed. Issues found or code coverage is not 100%." >&2
  echo "Check the SonarQube dashboard at ${SONAR_URL} for more details." >&2
  exit 1
fi
