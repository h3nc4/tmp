FROM gcr.io/distroless/java21 AS base

COPY ./api-central-*.jar /app/api-central.jar

FROM scratch

COPY --from=base / /

ENTRYPOINT ["java", "-jar", "/app/api-central.jar"]
