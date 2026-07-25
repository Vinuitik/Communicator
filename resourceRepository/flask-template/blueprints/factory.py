import os
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from app import find_file_path, save_files_transactional, delete_files_transactional


def make_entity_blueprint(entity_type: str, id_field: str, url_prefix: str | None = None) -> Blueprint:
    """Builds the upload/serve/delete blueprint shared by friends/groups/connections.

    id_field is the form/JSON key each caller already sends (friendId/groupId/
    connectionId) — kept per-entity since existing Java callers send that literal key.
    """
    bp = Blueprint(f'{entity_type}_files', __name__, url_prefix=url_prefix)

    @bp.route('/upload', methods=['POST'])
    def upload_files():
        if id_field not in request.form:
            return jsonify({'error': f'Missing {id_field} in form data'}), 400

        entity_id = request.form[id_field]

        if 'files' not in request.files:
            return jsonify({'error': 'No files part in the request'}), 400

        files = request.files.getlist('files')
        if not files or files[0].filename == '':
            return jsonify({'error': 'No files selected for uploading'}), 400

        return save_files_transactional(files, entity_type, entity_id)

    @bp.route('/file/<entity_id>/<filename>', methods=['GET'])
    def serve_file(entity_id, filename):
        safe_filename = secure_filename(filename)
        path = find_file_path(entity_type, entity_id, safe_filename)

        if not path or not os.path.isfile(path):
            return jsonify({'error': 'File not found'}), 404

        return send_file(path)

    @bp.route('/delete', methods=['POST'])
    def delete_files():
        data = request.get_json()
        if not data or 'fileNames' not in data or id_field not in data:
            return jsonify({'error': f'Missing "fileNames" or "{id_field}" in request body'}), 400

        file_names = data['fileNames']
        entity_id = data[id_field]

        if not isinstance(file_names, list):
            return jsonify({'error': '"fileNames" must be a list'}), 400

        return delete_files_transactional(file_names, entity_type, entity_id)

    return bp
