import io
import zipfile
import datetime
import os
from flask import Blueprint, jsonify, send_file
from ..app import RESOURCE_FOLDERS, BASE_DIR

backup_bp = Blueprint('backup', __name__)

@backup_bp.route('/backup', methods=['GET'])
def backup_all_files():
    """
    Creates a zip archive of all files for both friends and groups.
    """
    memory_file = io.BytesIO()
    found_files_count = 0

    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Iterate through each entity type (friends, groups)
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
