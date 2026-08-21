# Communicator JVM monolith — multi-module reactor build.
# Stage 1: build the whole reactor, produce bootstrap/target/app.jar
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Copy every module's pom first so dependency resolution is cached independently
# of source changes.
COPY pom.xml .
COPY services/knowledge-core/pom.xml services/knowledge-core/
COPY services/outbox-core/pom.xml services/outbox-core/
COPY services/friend/pom.xml services/friend/
COPY services/group/pom.xml services/group/
COPY services/connections/pom.xml services/connections/
COPY services/meeting/pom.xml services/meeting/
COPY services/chrono/pom.xml services/chrono/
COPY services/backup/pom.xml services/backup/
COPY services/bootstrap/pom.xml services/bootstrap/
RUN mvn -B -q dependency:go-offline -DskipTests || true

# Copy sources and package
COPY services/knowledge-core/src services/knowledge-core/src
COPY services/outbox-core/src services/outbox-core/src
COPY services/friend/src services/friend/src
COPY services/group/src services/group/src
COPY services/connections/src services/connections/src
COPY services/meeting/src services/meeting/src
COPY services/chrono/src services/chrono/src
COPY services/backup/src services/backup/src
COPY services/bootstrap/src services/bootstrap/src
RUN mvn -B clean package -DskipTests

# Stage 2: slim runtime image
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/services/bootstrap/target/app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
