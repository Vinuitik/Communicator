import os
import io
import zipfile
import datetime
import concurrent.futures
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
from flask_compress import Compress

app = Flask(__name__)

# Enable compression for text-based responses (JSON, HTML, CSS, JS)
# Images and videos are already compressed, so they won't be affected
Compress(app)

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
    Receives one or more files and saves them synchronously with rollback on failure.
    """
    if 'friendId' not in request.form:
        return jsonify({'error': 'Missing friendId in form data'}), 400
    
    friend_id = request.form['friendId']

    if 'files' not in request.files:
        return jsonify({'error': 'No files part in the request'}), 400

    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({'error': 'No files selected for uploading'}), 400

    # Pre-validate all files and prepare paths
    files_to_save = []
    for file in files:
        if file and file.filename:
            filename = secure_filename(file.filename)
            destination_folder = get_destination_folder(filename, friend_id)
            path = os.path.join(destination_folder, filename)
            
            # Check if file already exists
            if os.path.exists(path):
                return jsonify({'error': f'File {filename} already exists for friend {friend_id}'}), 409
            
            files_to_save.append({
                'file': file,
                'path': path,
                'folder': destination_folder,
                'filename': filename
            })

    # Create directories first
    try:
        for file_info in files_to_save:
            os.makedirs(file_info['folder'], exist_ok=True)
    except Exception as e:
        return jsonify({'error': f'Failed to create directories: {str(e)}'}), 500

    # Save files with rollback on failure
    saved_files = []
    try:
        for file_info in files_to_save:
            file_info['file'].save(file_info['path'])
            saved_files.append(file_info['path'])
    except Exception as e:
        # Rollback: delete any files that were saved
        for saved_path in saved_files:
            try:
                if os.path.exists(saved_path):
                    os.remove(saved_path)
            except Exception as cleanup_error:
                print(f"WARNING: Failed to cleanup {saved_path} during rollback: {cleanup_error}")
        
        return jsonify({'error': f'Failed to save files: {str(e)}. Upload cancelled.'}), 500

    return jsonify({
        'message': f'Successfully uploaded {len(saved_files)} file(s) for friend "{friend_id}"',
        'files': [os.path.basename(path) for path in saved_files]
    }), 201

@app.route('/file/<friend_id>/<filename>', methods=['GET'])
def serve_file(friend_id, filename):
    """Serves individual files for a specific friend."""
    safe_filename = secure_filename(filename)
    path = find_file_path(safe_filename, friend_id)
    
    if not path or not os.path.isfile(path):
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(path)

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
    
@app.route('/delete', methods=['POST'])
def delete_files():
    """
    Deletes specific files for a friend as a transaction.
    Expects a JSON body like: {"fileNames": ["file1.jpg"], "friendId": "123"}
    If any file cannot be deleted, no files are deleted.
    """
    data = request.get_json()
    if not data or 'fileNames' not in data or 'friendId' not in data:
        return jsonify({'error': 'Missing "fileNames" or "friendId" in request body'}), 400
    
    fileNames = data['fileNames']
    friend_id = data['friendId']

    if not isinstance(fileNames, list):
        return jsonify({'error': '"fileNames" must be a list'}), 400

    # Check existing files and read their contents for backup
    files_to_delete = []
    
    for fileName in fileNames:
        safe_filename = secure_filename(fileName)
        path = find_file_path(safe_filename, friend_id)
        
        if not path or not os.path.isfile(path):
            # File doesn't exist - consider it already deleted (success case)
            continue
        
        try:
            # Read file contents for potential rollback
            with open(path, 'rb') as f:
                file_content = f.read()
            files_to_delete.append({
                'path': path,
                'content': file_content,
                'filename': safe_filename
            })
        except Exception as e:
            return jsonify({'error': f'Failed to read file {safe_filename}: {str(e)}'}), 500

    # Try to delete all existing files, rolling back if any fail
    deleted_files = []
    try:
        for file_info in files_to_delete:
            os.remove(file_info['path'])
            deleted_files.append(file_info)
    except Exception as e:
        # Rollback with multiple attempts: restore any deleted files
        rollback_successful = True
        max_rollback_attempts = 3
        
        for file_info in deleted_files:
            rollback_attempt = 0
            fileRolledBack = False
            while rollback_attempt < max_rollback_attempts and ~fileRolledBack:
                try:
                    with open(file_info['path'], 'wb') as f:
                        f.write(file_info['content'])
                    fileRolledBack = True
                except Exception as restore_error:
                    rollback_attempt += 1
                    if rollback_attempt >= max_rollback_attempts:
                        # Critical failure - couldn't restore after multiple attempts
                        print(f"CRITICAL: Failed to restore {file_info['path']} after {max_rollback_attempts} attempts: {restore_error}")
                        rollback_successful = False
        
        if not rollback_successful:
            return jsonify({
                'error': f'Failed to delete all files AND rollback failed. Data may be corrupted. Original error: {str(e)}'
            }), 500
        else:
            return jsonify({'error': f'Failed to delete all files. Error: {str(e)}. Operation rolled back successfully.'}), 500

    total_processed = len(deleted_files)
    message = f'Successfully processed {total_processed} file(s) for friend {friend_id}.'
    
    return jsonify({'message': message}), 200