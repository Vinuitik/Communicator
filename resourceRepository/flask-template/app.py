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
    'friends': {
        'photos': os.path.join(BASE_DIR, 'photos'),
        'videos': os.path.join(BASE_DIR, 'videos'),
        'voice': os.path.join(BASE_DIR, 'voice'),
        'personal': os.path.join(BASE_DIR, 'personalResources')
    },
    'groups': {
        'photos': os.path.join(BASE_DIR, 'groups', 'photos'),
        'videos': os.path.join(BASE_DIR, 'groups', 'videos'),
        'voice': os.path.join(BASE_DIR, 'groups', 'voice'),
        'personal': os.path.join(BASE_DIR, 'groups', 'personalResources')
    }
}

# Create base resource folders if they don't exist
for entity_type in RESOURCE_FOLDERS.values():
    for folder in entity_type.values():
        os.makedirs(folder, exist_ok=True)

# --- Helper Functions ---
def get_destination_folder(entity_type, entity_id, filename):
    """Determines the destination folder based on file extension, entity type, and ID."""
    extension = os.path.splitext(filename)[1].lower()
    safe_entity_identifier = f"{secure_filename(str(entity_id))}"
    
    base_folder = RESOURCE_FOLDERS.get(entity_type)
    if not base_folder:
        raise ValueError(f"Invalid entity_type: {entity_type}")

    if extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
        return os.path.join(base_folder['photos'], safe_entity_identifier)
    elif extension in ['.mp4', '.mov', '.avi', '.mkv', '.webm']:
        return os.path.join(base_folder['videos'], safe_entity_identifier)
    elif extension in ['.mp3', '.wav', '.ogg', '.m4a']:
        return os.path.join(base_folder['voice'], safe_entity_identifier)
    else:
        return os.path.join(base_folder['personal'], safe_entity_identifier)

def find_file_path(entity_type, entity_id, filename):
    """Searches for a file in the specific entity's resource directory."""
    try:
        destination_folder = get_destination_folder(entity_type, entity_id, filename)
        path = os.path.join(destination_folder, filename)
        if os.path.isfile(path):
            return path
    except (ValueError, FileNotFoundError):
        return None
    return None

# --- Transactional File Operations ---
def save_files_transactional(files, entity_type, entity_id):
    """
    Saves one or more files with rollback on failure.
    """
    files_to_save = []
    for file in files:
        if file and file.filename:
            filename = secure_filename(file.filename)
            try:
                destination_folder = get_destination_folder(entity_type, entity_id, filename)
            except ValueError as e:
                return jsonify({'error': str(e)}), 400
            
            path = os.path.join(destination_folder, filename)
            
            if os.path.exists(path):
                return jsonify({'error': f'File {filename} already exists for {entity_type} {entity_id}'}), 409
            
            files_to_save.append({
                'file': file,
                'path': path,
                'folder': destination_folder,
                'filename': filename
            })

    try:
        for file_info in files_to_save:
            os.makedirs(file_info['folder'], exist_ok=True)
    except Exception as e:
        return jsonify({'error': f'Failed to create directories: {str(e)}'}), 500

    saved_files = []
    try:
        for file_info in files_to_save:
            # Reset stream position to the beginning before saving
            file_info['file'].stream.seek(0)
            file_info['file'].save(file_info['path'])
            saved_files.append(file_info['path'])
    except Exception as e:
        for saved_path in saved_files:
            try:
                if os.path.exists(saved_path):
                    os.remove(saved_path)
            except Exception as cleanup_error:
                print(f"WARNING: Failed to cleanup {saved_path} during rollback: {cleanup_error}")
        
        return jsonify({'error': f'Failed to save files: {str(e)}. Upload cancelled.'}), 500

    return jsonify({
        'message': f'Successfully uploaded {len(saved_files)} file(s) for {entity_type} "{entity_id}"',
        'files': [os.path.basename(path) for path in saved_files]
    }), 201

def delete_files_transactional(file_names, entity_type, entity_id):
    """
    Deletes specific files for an entity as a transaction.
    """
    files_to_delete = []
    for file_name in file_names:
        safe_filename = secure_filename(file_name)
        path = find_file_path(entity_type, entity_id, safe_filename)
        
        if not path or not os.path.isfile(path):
            continue
        
        try:
            with open(path, 'rb') as f:
                file_content = f.read()
            files_to_delete.append({
                'path': path,
                'content': file_content,
                'filename': safe_filename
            })
        except Exception as e:
            return jsonify({'error': f'Failed to read file {safe_filename}: {str(e)}'}), 500

    deleted_files = []
    try:
        for file_info in files_to_delete:
            os.remove(file_info['path'])
            deleted_files.append(file_info)
    except Exception as e:
        rollback_successful = True
        for file_info in deleted_files:
            try:
                with open(file_info['path'], 'wb') as f:
                    f.write(file_info['content'])
            except Exception as restore_error:
                print(f"CRITICAL: Failed to restore {file_info['path']}: {restore_error}")
                rollback_successful = False
        
        if not rollback_successful:
            return jsonify({
                'error': f'Failed to delete all files AND rollback failed. Data may be corrupted. Original error: {str(e)}'
            }), 500
        else:
            return jsonify({'error': f'Failed to delete all files. Error: {str(e)}. Operation rolled back successfully.'}), 500

    return jsonify({
        'message': f'Successfully deleted {len(deleted_files)} file(s) for {entity_type} {entity_id}.'
    }), 200

# --- Blueprints Registration ---
from blueprints.friends_files import friends_bp
from blueprints.groups_files import groups_bp
from blueprints.backup import backup_bp

app.register_blueprint(friends_bp)
app.register_blueprint(groups_bp)
app.register_blueprint(backup_bp)
