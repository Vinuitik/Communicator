import os
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from app import get_destination_folder, find_file_path, save_files_transactional, delete_files_transactional

groups_bp = Blueprint('groups_files', __name__, url_prefix='/groups')

@groups_bp.route('/upload', methods=['POST'])
def upload_files_group():
    """Handles file uploads for a specific group."""
    if 'groupId' not in request.form:
        return jsonify({'error': 'Missing groupId in form data'}), 400
    
    entity_id = request.form['groupId']
    
    if 'files' not in request.files:
        return jsonify({'error': 'No files part in the request'}), 400

    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({'error': 'No files selected for uploading'}), 400

    return save_files_transactional(files, 'groups', entity_id)

@groups_bp.route('/file/<group_id>/<filename>', methods=['GET'])
def serve_file_group(group_id, filename):
    """Serves an individual file for a specific group."""
    safe_filename = secure_filename(filename)
    path = find_file_path('groups', group_id, safe_filename)
    
    if not path or not os.path.isfile(path):
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(path)

@groups_bp.route('/delete', methods=['POST'])
def delete_files_group():
    """Deletes specific files for a group."""
    data = request.get_json()
    if not data or 'fileNames' not in data or 'groupId' not in data:
        return jsonify({'error': 'Missing "fileNames" or "groupId" in request body'}), 400
    
    file_names = data['fileNames']
    entity_id = data['groupId']

    if not isinstance(file_names, list):
        return jsonify({'error': '"fileNames" must be a list'}), 400

    return delete_files_transactional(file_names, 'groups', entity_id)
