from flask import Blueprint, render_template, redirect, url_for

home_bp = Blueprint("home", __name__)


@home_bp.route("/")
def index():
    """Renderiza la pantalla inicial de bienvenida del juego."""
    return render_template("home/home.html")


@home_bp.route("/favicon.ico")
def favicon():
    """Los navegadores piden /favicon.ico por defecto; se redirige al icono SVG."""
    return redirect(url_for("static", filename="img/favicon.svg"), code=301)
