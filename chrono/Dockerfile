# Stage 1: Build the application with dependency caching
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app/chrono

# Copy Maven settings with HTTP retry configuration for unstable networks
COPY chrono/maven-settings.xml /root/.m2/settings.xml

# Copy only the pom.xml to leverage Docker's layer caching
COPY chrono/pom.xml .

# Download all dependencies - Maven will auto-retry each artifact up to 5 times
RUN mvn dependency:go-offline -B

# Copy shared gRPC proto stubs used during Maven generate-sources phase
COPY communication_stubs ../communication_stubs

# Copy the rest of the source code
COPY chrono/src ./src

# Package the application
RUN mvn clean package -DskipTests -B

# Stage 2: Create the final, smaller image
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/chrono/target/app.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
