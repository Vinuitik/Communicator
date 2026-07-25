# Package initializer for blueprints
# This file makes the `blueprints` directory a Python package so imports like
# `from blueprints.factory import make_entity_blueprint` work when running in Docker.

from .factory import make_entity_blueprint
from .backup import backup_bp
