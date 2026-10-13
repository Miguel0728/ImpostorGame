from flask import Blueprint, abort, jsonify, redirect, render_template, request, session, url_for
from app.services.game_service import (
    DEFAULT_SETTINGS,
    build_configuration,
    get_available_categories,
    validate_configuration
)
from app.services.room_service import apply_action, build_room_state, create_room, get_room, new_token

room_bp = Blueprint("room", __name__)


def _render_configuration(config, error=None):
    """Renderiza el formulario de reglas en modo sala; responde 400 si hay un error de validación."""
    categories = get_available_categories()
    return render_template("setup/configurar.html", categories=categories, config=config, error=error, online=True), (400 if error else 200)


def _remember_token(code, token):
    """Guarda en la cookie el token con el que este navegador juega en la sala."""
    session["tokens"] = {**session.get("tokens", {}), code: token}


def _token_for(code):
    """Retorna el token de este navegador en la sala; si no tiene uno, le asigna uno nuevo."""
    token = session.get("tokens", {}).get(code) or new_token()
    _remember_token(code, token)
    return token


def _room_or_404(code):
    """Retorna la sala pedida o responde 404 si no existe o ya expiró."""
    return get_room(code) or abort(404)


@room_bp.route("/sala/nueva", methods=["GET", "POST"])
def nueva():
    """Crea una sala con las reglas elegidas y lleva al anfitrión a su lobby."""
    if request.method == "GET":
        return _render_configuration(dict(DEFAULT_SETTINGS))
    config = build_configuration(request.form)
    error = validate_configuration(config)
    if error:
        return _render_configuration(config, error)
    code, host_token = create_room(config)
    _remember_token(code, host_token)
    return redirect(url_for("room.sala", code=code))


@room_bp.route("/sala/<code>")
def sala(code):
    """Pantalla única de la sala: el navegador la actualiza según la fase que reporte el servidor."""
    if not get_room(code):
        return redirect(url_for("home.index"))
    return render_template("room/sala.html", code=code.upper())


@room_bp.route("/sala/<code>/estado")
def estado(code):
    """Entrega el estado de la sala desde el punto de vista del jugador que pregunta."""
    return jsonify(build_room_state(_room_or_404(code), _token_for(code.upper())))


@room_bp.route("/sala/<code>/accion", methods=["POST"])
def accion(code):
    """Aplica una acción del jugador (unirse, votar, avanzar fase...) y retorna el error si lo hay."""
    error = apply_action(_room_or_404(code), _token_for(code.upper()), request.form.get("accion"), request.form)
    return jsonify(error=error), (400 if error else 200)
