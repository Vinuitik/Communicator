# Resource Repository Microservice

This Flask-based microservice is designed to manage and serve user-generated content, such as photos, videos, and other personal files. It provides a structured and transactional approach to file storage, ensuring data integrity and organization.

## Core Architecture

The application is built on a modular, blueprint-based architecture to separate concerns and enhance maintainability.

-   **`app.py`**: This is the main entry point and core of the application. It handles:
    -   Flask app initialization and configuration (including compression).
    -   Definition of the global `RESOURCE_FOLDERS` configuration, which dictates the directory structure for all stored files.
    -   A suite of generalized helper functions (`get_destination_folder`, `find_file_path`) and transactional file operations (`save_files_transactional`, `delete_files_transactional`) that are imported and used by the various blueprints.
    -   Registration of all feature blueprints.

-   **`blueprints/`**: This directory contains the individual modules for each primary feature set.

    -   **`friends_files.py`**: Manages all file operations related to "friends." Its routes are registered at the root URL (`/`) to maintain compatibility with legacy systems.
    -   **`groups_files.py`**: Manages all file operations for "groups," with routes prefixed by `/groups`.
    -   **`connections_files.py`**: Manages all file operations for "connections," with routes prefixed by `/connections`.
    -   **`backup.py`**: Provides a single endpoint (`/backup`) to create a comprehensive zip archive of all resources managed by the service (friends, groups, and connections).

## Directory Structure

The service organizes stored files on the filesystem based on the entity type (friend, group, connection) and the file's media type.

-   **Friends' Files (Legacy Path):**
    -   `photos/<friend_id>/<filename>`
    -   `videos/<friend_id>/<filename>`
    -   `voice/<friend_id>/<filename>`
    -   `personalResources/<friend_id>/<filename>`

-   **Groups' Files:**
    -   `groups/photos/<group_id>/<filename>`
    -   `groups/videos/<group_id>/<filename>`
    -   ...and so on.

-   **Connections' Files:**
    -   `connections/photos/<connection_id>/<filename>`
    -   `connections/videos/<connection_id>/<filename>`
    -   ...and so on.

## API Endpoints

### Friends (`/`)

-   **`POST /upload`**: Uploads one or more files for a friend.
    -   **Body**: `multipart/form-data` with a `friendId` field and a `files` field containing the file(s).
-   **`POST /delete`**: Deletes one or more files for a friend.
    -   **Body**: `application/json` with `fileNames` (a list of strings) and `friendId`.
-   **`GET /file/<friend_id>/<filename>`**: Serves a specific file.

### Groups (`/groups`)

-   **`POST /groups/upload`**: Uploads files for a group.
    -   **Body**: `multipart/form-data` with a `groupId` field and a `files` field.
-   **`POST /groups/delete`**: Deletes files for a group.
    -   **Body**: `application/json` with `fileNames` and `groupId`.
-   **`GET /groups/file/<group_id>/<filename>`**: Serves a specific group file.

### Connections (`/connections`)

-   **`POST /connections/upload`**: Uploads files for a connection.
    -   **Body**: `multipart/form-data` with a `connectionId` field and a `files` field.
-   **`POST /connections/delete`**: Deletes files for a connection.
    -   **Body**: `application/json` with `fileNames` and `connectionId`.
-   **`GET /connections/file/<connection_id>/<filename>`**: Serves a specific connection file.

### Backup

-   **`GET /backup`**: Triggers a full backup of all resources (friends, groups, connections) and returns a single `.zip` archive.

## Transactional Operations

File uploads and deletions are designed to be transactional.

-   **Uploads**: If any file in a multi-file upload fails to save, the system will automatically roll back the operation by deleting any files that were successfully saved during that request.
-   **Deletions**: The system first verifies that all specified files exist. If any file fails to be deleted, the system attempts to restore any files that were already removed during the transaction to prevent partial data loss.
