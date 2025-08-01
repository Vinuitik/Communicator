# Use OpenJDK with a more complete base image (includes apt-get)
FROM openjdk:17-bullseye

# Set working directory
WORKDIR /app

# Install required system dependencies (PostgreSQL client, Python, pip)
RUN apt-get update && \
    apt-get install -y wget gnupg && \
    echo "deb http://apt.postgresql.org/pub/repos/apt bullseye-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - && \
    apt-get update && \
    apt-get install -y postgresql-client-17 python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*


# Copy and install Python dependencies
COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Copy backup-related files
COPY upload_to_drive.py .
COPY service-account-key.json .
COPY PostgresBackupService.java .
COPY FileBackupService.java .
COPY startup.sh .

# Make startup script executable
RUN chmod +x startup.sh

# Compile Java code
RUN javac PostgresBackupService.java FileBackupService.java

# Default command: Run startup script that starts both services
CMD ["./startup.sh"]
