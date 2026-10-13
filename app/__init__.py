import os
from flask import Flask


def create_app():
    """Crea y configura la instancia de la aplicación Flask."""
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "impostor-secret-key-2026")

    register_blueprints(app)
    return app


def register_blueprints(app):
    """Registra los blueprints de rutas de la aplicación."""
    from app.routes.home import home_bp
    from app.routes.game import game_bp
    app.register_blueprint(home_bp)
    app.register_blueprint(game_bp)
