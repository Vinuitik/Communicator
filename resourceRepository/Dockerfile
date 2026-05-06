FROM python:3.11-slim
WORKDIR /app

# postgresql-client for pg_dump (backup scheduler), gzip for compression
RUN apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client gzip && \
    rm -rf /var/lib/apt/lists/*

COPY resourceRepository/flask-template/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY resourceRepository/flask-template/ .

# Copy Google Drive credentials for the backup scheduler.
# Place service-account-key.json in resourceRepository/ before building.
# If the file is absent the scheduler still runs but skips Drive uploads.
COPY resourceRepository/service-account-key.json ./service-account-key.json

ENV PYTHONPATH=/app
EXPOSE 5000
ENV FLASK_APP=app.py
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]
