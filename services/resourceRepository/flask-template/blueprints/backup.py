import io
import zipfile
import datetime
import os
from flask import Blueprint, jsonify, send_file, request
from app import RESOURCE_FOLDERS, BASE_DIR

backup_bp = Blueprint('backup', __name__)

@backup_bp.route('/backup', methods=['GET'])
def backup_all_files():
    """
    Creates a zip archive of all files for friends, groups, and connections.
    """
    memory_file = io.BytesIO()
    found_files_count = 0

    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Iterate through each entity type (friends, groups, connections)
        for entity_type, resource_types in RESOURCE_FOLDERS.items():
            # Iterate through each resource type (photos, videos, etc.)
            for _, base_path in resource_types.items():
                if os.path.exists(base_path):
                    for root, _, files in os.walk(base_path):
                        for filename in files:
                            file_path = os.path.join(root, filename)
                            # Create a relative path for the archive
                            archive_path = os.path.relpath(file_path, BASE_DIR)
                            zf.write(file_path, arcname=archive_path)
                            found_files_count += 1

    memory_file.seek(0)

    if found_files_count == 0:
        return jsonify({'message': 'No files found to back up.'}), 200

    current_date = datetime.datetime.now().strftime("%Y-%m-%d")
    download_name = f'file_resources_backup_{current_date}.zip'

    return send_file(
        memory_file,
        download_name=download_name,
        as_attachment=True,
        mimetype='application/zip'
    )


@backup_bp.route('/restore', methods=['POST'])
def restore_all_files():
    """
    Restore media from a backup zip (as produced by GET /backup) posted as the raw
    request body (Content-Type: application/zip). Members were archived relative to
    BASE_DIR, so each is extracted back under BASE_DIR — overwriting existing files.

    Called by the backup service after it decrypts the latest media backup from Drive.
    """
    data = request.get_data()
    if not data:
        return jsonify({'error': 'Empty request body — expected a zip'}), 400

    base = os.path.abspath(BASE_DIR)
    extracted = 0
    skipped = []
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            for member in zf.infolist():
                if member.is_dir():
                    continue
                # Zip-slip guard: the resolved target must stay under BASE_DIR.
                target = os.path.abspath(os.path.join(base, member.filename))
                if target != base and not target.startswith(base + os.sep):
                    skipped.append(member.filename)
                    continue
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with zf.open(member) as src, open(target, 'wb') as dst:
                    dst.write(src.read())
                extracted += 1
    except zipfile.BadZipFile:
        return jsonify({'error': 'Request body is not a valid zip archive'}), 400

    resp = {'message': f'Restored {extracted} file(s).', 'restored': extracted}
    if skipped:
        resp['skipped_unsafe_paths'] = skipped
    return jsonify(resp), 200
