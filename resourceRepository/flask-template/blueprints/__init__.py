# Package initializer for blueprints
# This file makes the `blueprints` directory a Python package so imports like
# `from blueprints.friends_files import friends_bp` work when running in Docker.

# Optionally expose blueprints for convenience
from .friends_files import friends_bp
from .groups_files import groups_bp
from .connections_files import connections_bp
from .backup import backup_bp
