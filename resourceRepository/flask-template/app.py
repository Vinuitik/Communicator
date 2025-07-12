import os
import io
import zipfile
import datetime
import concurrent.futures
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename

app = Flask(__name__)

# --- Configuration ---
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
RESOURCE_FOLDERS = {
    'photos': os.path.join(BASE_DIR, 'photos'),
    'videos': os.path.join(BASE_DIR, 'videos'),
    'voice': os.path.join(BASE_DIR, 'voice'),
    'personal': os.path.join(BASE_DIR, 'personalResources')
}

# Create base resource folders if they don't exist
for folder in RESOURCE_FOLDERS.values():
    os.makedirs(folder, exist_ok=True)

# Thread pool for handling file saving in the background
executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

# --- Helper Functions ---
def get_destination_folder(filename, friend_id):
    """Determines the destination folder based on file extension and friend's name and ID."""
    extension = os.path.splitext(filename)[1].lower()
    safe_friend_identifier = f"{secure_filename(str(friend_id))}"
    
    if extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
        return os.path.join(RESOURCE_FOLDERS['photos'], safe_friend_identifier)
    elif extension in ['.mp4', '.mov', '.avi', '.mkv', '.webm']:
        return os.path.join(RESOURCE_FOLDERS['videos'], safe_friend_identifier)
    elif extension in ['.mp3', '.wav', '.ogg', '.m4a']:
        return os.path.join(RESOURCE_FOLDERS['voice'], safe_friend_identifier)
    else:
        return os.path.join(RESOURCE_FOLDERS['personal'], safe_friend_identifier)

def find_file_path(filename, friend_id):
    """Searches for a file in the specific friend's resource directory."""
    destination_folder = get_destination_folder(filename, friend_id)
    path = os.path.join(destination_folder, filename)
    if os.path.isfile(path):
        return path
    return None

# --- API Endpoints ---
@app.route('/upload', methods=['POST'])
def upload_files():
    """
    Receives one or more files and saves them asynchronously to a friend-specific folder.
    Expects a multipart/form-data request with 'files', 'friendId', and 'friendName' fields.
    """
    if 'friendId' not in request.form:
        return jsonify({'error': 'Missing friendName or friendId in form data'}), 400
    
    friend_id = request.form['friendId']

    if 'files' not in request.files:
        return jsonify({'error': 'No files part in the request'}), 400

    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({'error': 'No files selected for uploading'}), 400

    for file in files:
        if file:
            filename = secure_filename(file.filename)
            destination_folder = get_destination_folder(filename, friend_id)
            
            # Create the friend-specific directory if it doesn't exist
            os.makedirs(destination_folder, exist_ok=True)
            
            path = os.path.join(destination_folder, filename)
            # Submit the file save operation to the thread pool
            executor.submit(file.save, path)

    return jsonify({'message': f'{len(files)} file(s) for friend "{friend_id}" received and are being processed.'}), 202

@app.route('/files', methods=['POST'])
def get_files_batch():
    """
    Receives a list of filenames for a specific friend and returns them as a zip archive.
    Expects a JSON body like: 
    {"friendName": "some_friend", "friendId": "123", "filenames": ["file1.jpg", "document.pdf"]}
    To request all files for a friend, send ["*"] in the filenames list.
    """
    data = request.get_json()
    if not data  or 'friendId' not in data or 'filenames' not in data:
        return jsonify({'error': 'Missing "friendId", or "filenames" in request body'}), 400

    friend_id = data['friendId']
    filenames = data['filenames']
    if not isinstance(filenames, list):
        return jsonify({'error': '"filenames" must be a list'}), 400

    memory_file = io.BytesIO()
    found_files_count = 0
    safe_friend_identifier = f"{secure_filename(str(friend_id))}"

    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        if filenames == ['*']:
            # If '*' is requested, find all files for the friend
            for resource_folder in RESOURCE_FOLDERS.values():
                friend_dir = os.path.join(resource_folder, safe_friend_identifier)
                if os.path.isdir(friend_dir):
                    for item in os.listdir(friend_dir):
                        path = os.path.join(friend_dir, item)
                        if os.path.isfile(path):
                            zf.write(path, arcname=item)
                            found_files_count += 1
        else:
            # Original logic for specific filenames
            for filename in filenames:
                safe_filename = secure_filename(filename)
                path = find_file_path(safe_filename, friend_name, friend_id)
                if path:
                    zf.write(path, arcname=safe_filename)
                    found_files_count += 1

    memory_file.seek(0)

    if found_files_count == 0:
        return jsonify({'error': 'None of the requested files were found for the specified friend'}), 404

    return send_file(
        memory_file,
        download_name=f'resources_{secure_filename(friend_name)}_{secure_filename(str(friend_id))}.zip',
        as_attachment=True,
        mimetype='application/zip'
    )

@app.route('/backup', methods=['GET'])
def backup_all_files():
    """
    Creates a zip archive of all files in all resource directories for backup.
    """
    memory_file = io.BytesIO()
    found_files_count = 0

    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Iterate through each base resource category (photos, videos, etc.)
        for _, base_path in RESOURCE_FOLDERS.items():
            # os.walk is perfect for traversing all subdirectories and files
            for root, _, files in os.walk(base_path):
                for filename in files:
                    file_path = os.path.join(root, filename)
                    # Create a relative path for the archive to keep the structure
                    # e.g., photos/friendA_123/image.jpg
                    archive_path = os.path.relpath(file_path, BASE_DIR)
                    zf.write(file_path, arcname=archive_path)
                    found_files_count += 1

    memory_file.seek(0)

    if found_files_count == 0:
        return jsonify({'message': 'No files found to back up.'}), 200

    # Create a distinguishable filename with the current date
    current_date = datetime.datetime.now().strftime("%Y-%m-%d")
    download_name = f'file_resources_backup_{current_date}.zip'

    return send_file(
        memory_file,
        download_name=download_name,
        as_attachment=True,
        mimetype='application/zip'
    )