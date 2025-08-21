FROM maven:3.9-eclipse-temurin-21 AS api-central-builder
WORKDIR /app

RUN --mount=type=cache,target=/root/.m2 \
	mvn -v

COPY api-central/pom.xml .

RUN --mount=type=cache,target=/root/.m2 \
	mvn -e -B -DskipTests dependency:go-offline

COPY api-central/src ./src

RUN --mount=type=cache,target=/root/.m2 \
	mvn -e -B -DskipTests clean package

RUN mv target/api-central-*.jar /opt/api-central.jar

FROM gcr.io/distroless/java21 AS main

COPY --from=api-central-builder /opt/api-central.jar /app/

FROM scratch

COPY --from=api-central-builder / /

ENTRYPOINT ["java", "-jar", "/app/api-central.jar"]
