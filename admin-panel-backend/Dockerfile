# syntax=docker/dockerfile:1.4
# Локальный ~/.m2 подключается через compose build.additional_contexts (m2repo).
# Недостающие артефакты Maven скачивает из удалённых репозиториев; кэш BuildKit сохраняется между сборками.

FROM mirror.gcr.io/library/maven:3.9.9-eclipse-temurin-17-alpine AS build
WORKDIR /app

COPY pom.xml .

RUN --mount=type=bind,from=m2repo,source=.,target=/mnt/local-m2,readonly \
    --mount=type=cache,target=/root/.m2/repository \
    sh -ec '\
      if [ -d /mnt/local-m2 ] && [ -n "$(ls -A /mnt/local-m2 2>/dev/null)" ]; then \
        mkdir -p /root/.m2/repository; \
        cp -a /mnt/local-m2/. /root/.m2/repository/; \
      fi; \
      mvn -B -DskipTests dependency:go-offline \
    '

COPY src ./src

RUN --mount=type=cache,target=/root/.m2/repository \
    sh -ec '\
      mvn -B -DskipTests package; \
      JAR=$(ls /app/target/admin-panel-backend-*.jar | grep -v plain | head -1); \
      cp "$JAR" /app/app.jar \
    '

FROM mirror.gcr.io/library/eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring
COPY --from=build /app/app.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
