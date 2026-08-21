# Use an official Python base image
FROM python:3.11-slim

# Set environment vars
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Set working directory
WORKDIR /app

# Install system dependencies first (cached layer if unchanged)
RUN apt-get clean && \
    apt-get update --fix-missing && \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Copy requirements first for better caching
COPY requirements.txt /app/

# Install Python dependencies (cached layer if requirements.txt unchanged)
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy project files (after dependencies for better Docker layer caching)
COPY . /app

# Create logs directory
RUN mkdir -p /app/logs

# Expose the port FastAPI runs on
EXPOSE 8001

# Run the service using the new main module
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
