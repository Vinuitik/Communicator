# Stage 1: Build the application with dependency caching
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

# Copy Maven settings with HTTP retry configuration for unstable networks
COPY maven-settings.xml /root/.m2/settings.xml

# Copy only the pom.xml to leverage Docker's layer caching
COPY pom.xml .

# Download all dependencies - Maven will auto-retry each artifact up to 5 times
RUN mvn dependency:go-offline -B

# Copy the rest of the source code
COPY src ./src

# Package the application
RUN mvn clean package -DskipTests -B

# Stage 2: Create the final, smaller image
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/target/app.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
