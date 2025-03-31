# Use OpenJDK with a more complete base image (includes apt-get)
FROM openjdk:17-bullseye

# Set working directory
WORKDIR /app

# Install required system dependencies (PostgreSQL client, Python, pip)
<<<<<<< HEAD:backup/Dockerfile
RUN apt-get update && \
    apt-get install -y wget gnupg && \
    echo "deb http://apt.postgresql.org/pub/repos/apt bullseye-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - && \
    apt-get update && \
    apt-get install -y postgresql-client-17 python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

=======
RUN apt-get update && apt-get install -y \
    postgresql-client \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/* 
>>>>>>> 03fd665330737eb66cd80b3a789af0caba8d5c8c:project/backup/Dockerfile

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Copy backup-related files
COPY upload_to_drive.py .
COPY service-account-key.json .
COPY PostgresBackupService.java .

# Compile Java code
RUN javac PostgresBackupService.java

# Default command: Run Java backup service
CMD ["java", "PostgresBackupService"]
