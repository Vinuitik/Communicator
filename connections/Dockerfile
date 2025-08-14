# Stage 1: Build the application with dependency caching
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Copy only the pom.xml to leverage Docker's layer caching
COPY pom.xml .

# Download all dependencies. This layer is cached as long as pom.xml doesn't change.
RUN mvn dependency:go-offline

# Copy the rest of the source code
COPY src ./src

# Package the application
RUN mvn clean package -DskipTests

# Stage 2: Create the final, smaller image
FROM openjdk:21-slim
WORKDIR /app
COPY --from=build /app/target/Connections.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]