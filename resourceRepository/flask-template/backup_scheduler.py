import os
import subprocess
import datetime
import zipfile
from apscheduler.schedulers.background import BackgroundScheduler

BACKUP_DIR = '/app/backups'
DB_NAME = os.environ.get('POSTGRES_DB', 'my_database')
DB_USER = os.environ.get('POSTGRES_USER', 'myapp_user')
DB_PASSWORD = os.environ.get('POSTGRES_PASSWORD', 'example')
DB_HOST = os.environ.get('POSTGRES_HOST', 'postgresDB')

CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), 'service-account-key.json')
DRIVE_FOLDER_ID = '1vqdqkQTepjup2RODZr4-7_X-q5PE1bV3'

# Mirror the folder structure from app.py so we don't create a circular import
_BASE = '/app'
BACKUP_RESOURCE_FOLDERS = {
    'friends': {
        'photos': f'{_BASE}/photos',
        'videos': f'{_BASE}/videos',
        'voice': f'{_BASE}/voice',
        'personal': f'{_BASE}/personalResources',
    },
    'groups': {
        'photos': f'{_BASE}/groups/photos',
        'videos': f'{_BASE}/groups/videos',
        'voice': f'{_BASE}/groups/voice',
        'personal': f'{_BASE}/groups/personalResources',
    },
    'connections': {
        'photos': f'{_BASE}/connections/photos',
        'videos': f'{_BASE}/connections/videos',
        'voice': f'{_BASE}/connections/voice',
        'personal': f'{_BASE}/connections/personalResources',
    },
}


def _upload_to_drive(file_path):
    if not os.path.exists(CREDENTIALS_PATH):
        print(f'[backup] No credentials file found at {CREDENTIALS_PATH}, skipping Drive upload')
        return
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload

        creds = service_account.Credentials.from_service_account_file(
            CREDENTIALS_PATH, scopes=['https://www.googleapis.com/auth/drive.file']
        )
        service = build('drive', 'v3', credentials=creds)
        metadata = {'name': os.path.basename(file_path), 'parents': [DRIVE_FOLDER_ID]}
        media = MediaFileUpload(file_path, resumable=True)
        result = service.files().create(body=metadata, media_body=media, fields='id').execute()
        print(f'[backup] Uploaded to Drive: {result.get("id")}')
    except Exception as e:
        print(f'[backup] Drive upload failed: {e}')


def run_postgres_backup():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    sql_file = os.path.join(BACKUP_DIR, f'postgres_backup_{ts}.sql')
    gz_file = sql_file + '.gz'

    print('[backup] Starting postgres backup...')
    env = os.environ.copy()
    env['PGPASSWORD'] = DB_PASSWORD
    result = subprocess.run(
        [
            'pg_dump',
            '-h', DB_HOST, '-p', '5432', '-U', DB_USER, '-d', DB_NAME,
            '-f', sql_file, '-F', 'p',
            '--column-inserts', '--inserts', '--no-owner', '--no-privileges',
            '--clean', '--if-exists',
        ],
        env=env, capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f'[backup] pg_dump failed: {result.stderr}')
        return

    compress = subprocess.run(['gzip', '-9', sql_file], capture_output=True)
    if compress.returncode != 0:
        print('[backup] gzip compression failed')
        return

    print(f'[backup] Postgres backup created: {gz_file}')
    _upload_to_drive(gz_file)
    try:
        os.remove(gz_file)
    except OSError:
        pass


def run_files_backup():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    zip_path = os.path.join(BACKUP_DIR, f'files_backup_{ts}.zip')
    found = 0

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for _, resource_types in BACKUP_RESOURCE_FOLDERS.items():
            for _, base_path in resource_types.items():
                if os.path.exists(base_path):
                    for root, _, files in os.walk(base_path):
                        for filename in files:
                            full_path = os.path.join(root, filename)
                            archive_name = os.path.relpath(full_path, _BASE)
                            zf.write(full_path, arcname=archive_name)
                            found += 1

    if found == 0:
        print('[backup] No files found, skipping file backup')
        try:
            os.remove(zip_path)
        except OSError:
            pass
        return

    print(f'[backup] Files backup created: {zip_path} ({found} files)')
    _upload_to_drive(zip_path)
    try:
        os.remove(zip_path)
    except OSError:
        pass


def start_backup_scheduler():
    # Delay first run by 2 minutes so postgres has time to be ready on cold start
    first_run = datetime.datetime.now() + datetime.timedelta(minutes=2)
    scheduler = BackgroundScheduler()
    scheduler.add_job(run_postgres_backup, 'interval', hours=24, id='postgres_backup', next_run_time=first_run)
    scheduler.add_job(run_files_backup, 'interval', hours=24, id='files_backup', next_run_time=first_run)
    scheduler.start()
    print('[backup] Scheduler started — first run in 2 min, then every 24h')
