import os
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from app import get_destination_folder, find_file_path, save_files_transactional, delete_files_transactional

friends_bp = Blueprint('friends_files', __name__)

@friends_bp.route('/upload', methods=['POST'])
def upload_files_friend():
    """Handles file uploads for a specific friend."""
    if 'friendId' not in request.form:
        return jsonify({'error': 'Missing friendId in form data'}), 400
    
    entity_id = request.form['friendId']
    
    if 'files' not in request.files:
        return jsonify({'error': 'No files part in the request'}), 400

    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({'error': 'No files selected for uploading'}), 400

    return save_files_transactional(files, 'friends', entity_id)

@friends_bp.route('/file/<friend_id>/<filename>', methods=['GET'])
def serve_file_friend(friend_id, filename):
    """Serves an individual file for a specific friend."""
    safe_filename = secure_filename(filename)
    path = find_file_path('friends', friend_id, safe_filename)
    
    if not path or not os.path.isfile(path):
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(path)

@friends_bp.route('/delete', methods=['POST'])
def delete_files_friend():
    """Deletes specific files for a friend."""
    data = request.get_json()
    if not data or 'fileNames' not in data or 'friendId' not in data:
        return jsonify({'error': 'Missing "fileNames" or "friendId" in request body'}), 400
    
    file_names = data['fileNames']
    entity_id = data['friendId']

    if not isinstance(file_names, list):
        return jsonify({'error': '"fileNames" must be a list'}), 400

    return delete_files_transactional(file_names, 'friends', entity_id)
