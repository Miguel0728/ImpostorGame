from flask import Blueprint, render_template, send_from_directory
from app.services.game_service import DEFAULT_SETTINGS, WORDS_FILE, get_available_categories

game_bp = Blueprint("game", __name__)

# El modo local (Pass & Play) corre entero en el navegador (static/js/modo-local.js):
# estas rutas solo entregan las pantallas y la lista de palabras, sin guardar estado en el servidor.


@game_bp.route("/configurar")
def configurar():
    """Pantalla de reglas; el navegador aplica la configuración guardada en el dispositivo."""
    return render_template("setup/configurar.html", categories=get_available_categories(), config=dict(DEFAULT_SETTINGS))


@game_bp.route("/jugadores")
def jugadores():
    """Pantalla para nombrar a cada jugador."""
    return render_template("setup/jugadores.html")


@game_bp.route("/roles")
def roles():
    """Reparto de roles en modo pásalo."""
    return render_template("game/roles.html")


@game_bp.route("/juego")
def juego():
    """Pantalla activa de debate con temporizador y turnos de jugadores."""
    return render_template("game/juego.html")


@game_bp.route("/votacion")
def votacion():
    """Pantalla donde cada jugador emite su voto."""
    return render_template("voting/votacion.html")


@game_bp.route("/resultado")
def resultado():
    """Veredicto de la votación: descubrimiento del impostor o su victoria."""
    return render_template("voting/resultado.html")


@game_bp.route("/datos/palabras.json")
def palabras():
    """Entrega el archivo de palabras que usa el modo local."""
    return send_from_directory(WORDS_FILE.parent, WORDS_FILE.name, mimetype="application/json")
