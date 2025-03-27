import sys
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Google Drive API credentials
CREDENTIALS_PATH = 'service-account-key.json'
FOLDER_ID = '1vqdqkQTepjup2RODZr4-7_X-q5PE1bV3'  # Replace with your actual folder ID

def upload_to_drive(file_path):
    credentials = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=['https://www.googleapis.com/auth/drive.file']
    )
    
    drive_service = build('drive', 'v3', credentials=credentials)

    file_metadata = {
        'name': os.path.basename(file_path),
        'parents': [FOLDER_ID]
    }

    media = MediaFileUpload(file_path, resumable=True)
    file = drive_service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    
    print(f"Backup uploaded: {file.get('id')}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python upload_to_drive.py <file_path>")
        sys.exit(1)

    upload_to_drive(sys.argv[1])
