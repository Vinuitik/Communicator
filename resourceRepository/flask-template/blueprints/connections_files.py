import os
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from app import find_file_path, save_files_transactional, delete_files_transactional

connections_bp = Blueprint('connections_files', __name__, url_prefix='/connections')

@connections_bp.route('/upload', methods=['POST'])
def upload_files_connection():
    """Handles file uploads for a specific connection."""
    if 'connectionId' not in request.form:
        return jsonify({'error': 'Missing connectionId in form data'}), 400
    
    entity_id = request.form['connectionId']
    
    if 'files' not in request.files:
        return jsonify({'error': 'No files part in the request'}), 400

    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({'error': 'No files selected for uploading'}), 400

    return save_files_transactional(files, 'connections', entity_id)

@connections_bp.route('/file/<connection_id>/<filename>', methods=['GET'])
def serve_file_connection(connection_id, filename):
    """Serves an individual file for a specific connection."""
    safe_filename = secure_filename(filename)
    path = find_file_path('connections', connection_id, safe_filename)
    
    if not path or not os.path.isfile(path):
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(path)

@connections_bp.route('/delete', methods=['POST'])
def delete_files_connection():
    """Deletes specific files for a connection."""
    data = request.get_json()
    if not data or 'fileNames' not in data or 'connectionId' not in data:
        return jsonify({'error': 'Missing "fileNames" or "connectionId" in request body'}), 400
    
    file_names = data['fileNames']
    entity_id = data['connectionId']

    if not isinstance(file_names, list):
        return jsonify({'error': '"fileNames" must be a list'}), 400

    return delete_files_transactional(file_names, 'connections', entity_id)
