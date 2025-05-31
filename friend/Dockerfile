# Use Maven to build the app, then use a slim Java image to run it

# Build stage
FROM maven:3.9.6-eclipse-temurin-21 AS build

WORKDIR /app

# Copy pom.xml and download dependencies (for better caching)
COPY pom.xml .
RUN mvn dependency:go-offline

# Copy the rest of the source code
COPY src ./src

# Build the application
RUN mvn clean package -DskipTests

# Runtime stage
FROM openjdk:21-slim

WORKDIR /app

# Copy the built jar from the build stage
COPY --from=build /app/target/FriendCRM.jar app.jar

EXPOSE 8085

ENTRYPOINT ["java", "-jar", "app.jar"]
