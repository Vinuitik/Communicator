FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY ./flask-template/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire Flask application into the container (this includes the
# `blueprints/` package so imports like `from blueprints...` resolve)
COPY ./flask-template/ .

# Ensure the application directory is on Python path (defensive)
ENV PYTHONPATH=/app

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Define environment variable
ENV FLASK_APP=app.py

# Run the command to start the Flask server
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]