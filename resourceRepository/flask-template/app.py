import os
import io
import zipfile
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
def get_destination_folder(filename, friend_name):
    """Determines the destination folder based on file extension and friend's name."""
    extension = os.path.splitext(filename)[1].lower()
    safe_friend_name = secure_filename(friend_name)
    
    if extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
        return os.path.join(RESOURCE_FOLDERS['photos'], safe_friend_name)
    elif extension in ['.mp4', '.mov', '.avi', '.mkv', '.webm']:
        return os.path.join(RESOURCE_FOLDERS['videos'], safe_friend_name)
    elif extension in ['.mp3', '.wav', '.ogg', '.m4a']:
        return os.path.join(RESOURCE_FOLDERS['voice'], safe_friend_name)
    else:
        return os.path.join(RESOURCE_FOLDERS['personal'], safe_friend_name)

def find_file_path(filename, friend_name):
    """Searches for a file in the specific friend's resource directory."""
    destination_folder = get_destination_folder(filename, friend_name)
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
    if 'friendName' not in request.form or 'friendId' not in request.form:
        return jsonify({'error': 'Missing friendName or friendId in form data'}), 400
    
    friend_name = request.form['friendName']

    if 'files' not in request.files:
        return jsonify({'error': 'No files part in the request'}), 400

    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({'error': 'No files selected for uploading'}), 400

    for file in files:
        if file:
            filename = secure_filename(file.filename)
            destination_folder = get_destination_folder(filename, friend_name)
            
            # Create the friend-specific directory if it doesn't exist
            os.makedirs(destination_folder, exist_ok=True)
            
            path = os.path.join(destination_folder, filename)
            # Submit the file save operation to the thread pool
            executor.submit(file.save, path)

    return jsonify({'message': f'{len(files)} file(s) for friend "{friend_name}" received and are being processed.'}), 202

@app.route('/files', methods=['POST'])
def get_files_batch():
    """
    Receives a list of filenames for a specific friend and returns them as a zip archive.
    Expects a JSON body like: 
    {"friendName": "some_friend", "friendId": "123", "filenames": ["file1.jpg", "document.pdf"]}
    """
    data = request.get_json()
    if not data or 'friendName' not in data or 'friendId' not in data or 'filenames' not in data:
        return jsonify({'error': 'Missing "friendName", "friendId", or "filenames" in request body'}), 400

    friend_name = data['friendName']
    filenames = data['filenames']
    if not isinstance(filenames, list):
        return jsonify({'error': '"filenames" must be a list'}), 400

    memory_file = io.BytesIO()
    found_files_count = 0

    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for filename in filenames:
            safe_filename = secure_filename(filename)
            path = find_file_path(safe_filename, friend_name)
            if path:
                zf.write(path, arcname=safe_filename)
                found_files_count += 1

    memory_file.seek(0)

    if found_files_count == 0:
        return jsonify({'error': 'None of the requested files were found for the specified friend'}), 404

    return send_file(
        memory_file,
        download_name=f'resources_{secure_filename(friend_name)}.zip',
        as_attachment=True,
        mimetype='application/zip'
    )