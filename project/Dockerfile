# Use a Java base image to build the app
FROM openjdk:21-slim as build

# Set the working directory in the container
WORKDIR /app

# Copy your project’s JAR file into the container
COPY target/FriendCRM.jar app.jar

# Expose the port your app will run on
EXPOSE 8085

# Command to run your app
ENTRYPOINT ["java", "-jar", "app.jar"]
