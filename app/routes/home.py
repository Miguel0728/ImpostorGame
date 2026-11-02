import os

from flask import Blueprint, render_template, redirect, url_for

home_bp = Blueprint("home", __name__)


@home_bp.route("/")
def index():
    """Renderiza la pantalla inicial de bienvenida del juego."""
    return render_template("home/home.html")


@home_bp.route("/privacidad")
def privacidad():
    """Política de privacidad pública que pide Google Play; el correo de contacto sale de CONTACT_EMAIL."""
    return render_template("legal/privacidad.html", contact_email=os.environ.get("CONTACT_EMAIL", "").strip())


@home_bp.route("/healthz")
def healthz():
    """Ruta de salud para que el hosting compruebe que el servidor responde."""
    return "ok", 200


@home_bp.route("/favicon.ico")
def favicon():
    """Los navegadores piden /favicon.ico por defecto; se redirige al icono PNG."""
    return redirect(url_for("static", filename="img/sospecha-icon.png"), code=302)
