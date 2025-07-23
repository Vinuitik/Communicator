# Use an official Python base image
FROM python:3.11-slim

# Set environment vars
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Copy project files
COPY . /app

# Install system dependencies
RUN apt-get update && apt-get install -y build-essential

# Install Python dependencies
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Expose the port FastAPI runs on
EXPOSE 8000

# Run the service
CMD ["uvicorn", "ai_agent_service:app", "--host", "0.0.0.0", "--port", "8000"]
