# Stage 1: Build
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app/communicator-core

COPY communicator-core/pom.xml .
RUN mvn dependency:go-offline

COPY communicator-core/src ./src
RUN mvn clean package -DskipTests

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/communicator-core/target/communicator-core.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
