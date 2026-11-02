import logging
import os
import secrets

from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix


def _is_development():
    """Indica si se ejecuta en desarrollo (FLASK_DEBUG activo); en cualquier otro caso es producción."""
    return os.environ.get("FLASK_DEBUG", "").lower() in ("1", "true", "on")


def _load_secret_key(development):
    """Lee SECRET_KEY del entorno; en producción es obligatoria y en desarrollo se usa una temporal."""
    key = os.environ.get("SECRET_KEY")
    if key:
        return key
    if not development:
        raise RuntimeError(
            "Falta la variable de entorno SECRET_KEY. Define una clave larga y aleatoria "
            "antes de iniciar el servidor (por ejemplo: python -c \"import secrets; print(secrets.token_hex(32))\")."
        )
    logging.warning("SECRET_KEY no está definida: se usa una clave temporal y las sesiones se pierden al reiniciar.")
    return secrets.token_hex(32)


def create_app():
    """Crea y configura la instancia de la aplicación Flask."""
    app = Flask(__name__)
    development = _is_development()
    app.config["SECRET_KEY"] = _load_secret_key(development)
    app.config["SESSION_COOKIE_SECURE"] = not development
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    proxies = int(os.environ.get("TRUST_PROXY", "0"))
    if proxies:
        # Detrás de un proxy del hosting, la IP real del visitante llega en X-Forwarded-For.
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=proxies, x_proto=proxies, x_host=proxies)

    register_blueprints(app)
    return app


def register_blueprints(app):
    """Registra los blueprints de rutas de la aplicación."""
    from app.routes.home import home_bp
    from app.routes.game import game_bp
    from app.routes.room import room_bp
    from app.routes.pwa import pwa_bp
    app.register_blueprint(home_bp)
    app.register_blueprint(game_bp)
    app.register_blueprint(room_bp)
    app.register_blueprint(pwa_bp)
