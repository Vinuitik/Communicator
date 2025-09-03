# Use an official Python base image
FROM python:3.11-slim

# Set environment vars
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt /app/

# Install system dependencies
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy project files (after dependencies for better Docker layer caching)
COPY . /app

# Expose the port FastAPI runs on
EXPOSE 8001

# Run the service using the new main module
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
