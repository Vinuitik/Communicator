import os
import zipfile
import psycopg2
from googleapiclient.discovery import build
from google.oauth2 import service_account
from googleapiclient.http import MediaIoBaseDownload
import io

# Google Drive folder ID containing backups
DRIVE_FOLDER_ID = "your_google_drive_folder_id_here"

# PostgreSQL connection details
PG_HOST = "localhost"  # Change if running in Docker (e.g., 'db' if in docker-compose)
PG_PORT = "5432"
PG_USER = "your_postgres_user"
PG_PASSWORD = "your_postgres_password"
PG_DATABASE = "your_database_name"

# Path to your service account key
SERVICE_ACCOUNT_FILE = "service-account-key.json"

# Path for downloading and extracting files
DOWNLOAD_DIR = "backups"
EXTRACTED_FILE = "backup.sql"


def authenticate():
    """Authenticate with Google Drive using a service account."""
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=["https://www.googleapis.com/auth/drive"]
    )
    return creds


def get_latest_backup(service):
    """Get the latest backup file from Google Drive."""
    results = service.files().list(
        q=f"'{DRIVE_FOLDER_ID}' in parents and mimeType='application/zip'",
        fields="files(id, name)",
        orderBy="name desc"  # Sort lexicographically in descending order
    ).execute()

    files = results.get('files', [])
    
    if not files:
        print("No backup files found.")
        return None, None

    latest_file = files[0]  # First file is the latest due to sorting
    return latest_file['id'], latest_file['name']


def download_file(service, file_id, destination):
    """Download a file from Google Drive."""
    request = service.files().get_media(fileId=file_id)
    
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    file_path = os.path.join(DOWNLOAD_DIR, destination)

    with open(file_path, "wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            print(f"Download {int(status.progress() * 100)}% complete.")

    print(f"Backup downloaded to {file_path}")
    return file_path


def extract_zip(zip_path):
    """Extract a zip file and return the extracted SQL file path."""
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(DOWNLOAD_DIR)
        extracted_files = zip_ref.namelist()

    for file in extracted_files:
        if file.endswith(".sql"):
            return os.path.join(DOWNLOAD_DIR, file)
    
    print("No SQL file found in the archive.")
    return None


def restore_postgres(sql_file):
    """Restore the PostgreSQL database from a SQL dump."""
    try:
        conn = psycopg2.connect(
            host=PG_HOST,
            port=PG_PORT,
            user=PG_USER,
            password=PG_PASSWORD,
            dbname=PG_DATABASE
        )
        conn.autocommit = True
        cursor = conn.cursor()

        print(f"Restoring database from {sql_file}...")
        with open(sql_file, "r") as f:
            cursor.execute(f.read())

        cursor.close()
        conn.close()
        print("Database restored successfully!")
    
    except Exception as e:
        print(f"Error restoring database: {e}")


if __name__ == "__main__":
    service = build("drive", "v3", credentials=authenticate())

    # Step 1: Get the latest backup file
    file_id, file_name = get_latest_backup(service)
    if not file_id:
        exit(1)

    # Step 2: Download the file
    zip_path = download_file(service, file_id, file_name)

    # Step 3: Extract SQL file from ZIP
    sql_file = extract_zip(zip_path)
    if not sql_file:
        exit(1)

    # Step 4: Restore PostgreSQL database
    restore_postgres(sql_file)
