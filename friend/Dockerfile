# Stage 1: Build the application with dependency caching
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app/friend

# Copy only the pom.xml to leverage Docker's layer caching
COPY friend/pom.xml .

# Download all dependencies. This layer is cached as long as pom.xml doesn't change.
RUN mvn dependency:go-offline

# Copy shared gRPC proto stubs used during Maven generate-sources phase
COPY communication_stubs ../communication_stubs

# Copy the rest of the source code
COPY friend/src ./src

# Package the application
RUN mvn clean package -DskipTests

# Stage 2: Create the final, smaller image
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/friend/target/FriendCRM.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
