FROM mirror.gcr.io/library/maven:3.9.9-eclipse-temurin-17-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package \
    && JAR=$(ls /app/target/admin-panel-backend-*.jar | grep -v plain | head -1) \
    && cp "$JAR" /app/app.jar

FROM mirror.gcr.io/library/eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring
COPY --from=build /app/app.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
