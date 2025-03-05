# Use OpenJDK with a more complete base image (includes apt-get)
FROM openjdk:17-buster

# Set working directory
WORKDIR /app

# Install required system dependencies (PostgreSQL client, Python, pip)
RUN apt-get update && apt-get install -y \
    postgresql-client \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*  # Clean up to reduce image size

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip3 install -r requirements.txt  # No --no-cache-dir flag

# Copy backup-related files
COPY upload_to_drive.py .
COPY service-account-key.json .
COPY PostgresBackupService.java .

# Compile Java code
RUN javac PostgresBackupService.java

# Default command: Run Java backup service
CMD ["java", "PostgresBackupService"]
