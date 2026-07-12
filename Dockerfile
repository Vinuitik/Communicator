# Communicator JVM monolith — multi-module reactor build.
# Stage 1: build the whole reactor, produce bootstrap/target/app.jar
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Copy every module's pom first so dependency resolution is cached independently
# of source changes.
COPY pom.xml .
COPY friend/pom.xml friend/
COPY group/pom.xml group/
COPY connections/pom.xml connections/
COPY chrono/pom.xml chrono/
COPY backup/pom.xml backup/
COPY bootstrap/pom.xml bootstrap/
RUN mvn -B -q dependency:go-offline -DskipTests || true

# Copy sources and package
COPY friend/src friend/src
COPY group/src group/src
COPY connections/src connections/src
COPY chrono/src chrono/src
COPY backup/src backup/src
COPY bootstrap/src bootstrap/src
RUN mvn -B clean package -DskipTests

# Stage 2: slim runtime image
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/bootstrap/target/app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
