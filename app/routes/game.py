from flask import Blueprint, render_template, request, redirect, url_for, session
from app.services.game_service import (
    get_available_categories,
    get_game_configuration,
    save_configuration,
    build_configuration,
    validate_configuration,
    generate_player_slots,
    save_player_names,
    validate_player_names,
    initialize_new_game,
    get_gameplay_data,
    get_stored_roles,
    resolve_voting_outcome,
    advance_to_next_round
)

game_bp = Blueprint("game", __name__)


def _render_configuration(config, error=None):
    """Renderiza el formulario de configuración; responde 400 si hay un error de validación."""
    categories = get_available_categories()
    return render_template("setup/configurar.html", categories=categories, config=config, error=error), (400 if error else 200)


def _submit_configuration():
    """Valida y guarda la configuración enviada; si es inválida vuelve a mostrar el formulario."""
    config = build_configuration(request.form)
    error = validate_configuration(config)
    if error:
        return _render_configuration(config, error)
    save_configuration(session, config)
    return redirect(url_for("game.jugadores"))


@game_bp.route("/configurar", methods=["GET", "POST"])
def configurar():
    """Maneja la vista y el guardado de parámetros de configuración."""
    if request.method == "POST":
        return _submit_configuration()
    return _render_configuration(get_game_configuration(session))


def _render_players(names=None, error=None):
    """Renderiza el formulario de nombres; responde 400 si hay un error de validación."""
    config = get_game_configuration(session)
    slots = generate_player_slots(config["players"], names)
    return render_template("setup/jugadores.html", config=config, slots=slots, error=error), (400 if error else 200)


def _submit_players():
    """Valida los nombres enviados, reparte los roles y avanza; si hay error vuelve al formulario."""
    expected = get_game_configuration(session)["players"]
    names, error = validate_player_names(request.form.getlist("player_name"), expected)
    if error:
        return _render_players(names, error)
    save_player_names(session, names)
    initialize_new_game(session)
    return redirect(url_for("game.roles"))


@game_bp.route("/jugadores", methods=["GET", "POST"])
def jugadores():
    """Maneja la vista tipo wizard para nombrar a cada jugador."""
    if request.method == "POST":
        return _submit_players()
    return _render_players()


@game_bp.route("/roles", methods=["GET"])
def roles():
    """Renderiza el front-end interactivo para el reparto de roles en modo pásalo."""
    return render_template("game/roles.html", roles_data=get_stored_roles(session))


@game_bp.route("/juego", methods=["GET"])
def juego():
    """Renderiza la pantalla activa de debate con temporizador y turnos de jugadores."""
    return render_template("game/juego.html", gameplay=get_gameplay_data(session))


@game_bp.route("/votacion", methods=["GET", "POST"])
def votacion():
    """Gestiona la emisión de votos de la tripulación."""
    if request.method == "POST":
        session["outcome"] = resolve_voting_outcome(session, request.form.getlist("voted_target"))
        return redirect(url_for("game.resultado"))
    return render_template("voting/votacion.html", players=get_stored_roles(session))


@game_bp.route("/resultado", methods=["GET"])
def resultado():
    """Presenta el veredicto de la votación: expulsión del impostor o su victoria."""
    outcome = session.get("outcome")
    if not outcome:
        return redirect(url_for("home.index"))
    return render_template("voting/resultado.html", outcome=outcome)


@game_bp.route("/siguiente-ronda", methods=["GET"])
def siguiente_ronda():
    """Avanza a la siguiente ronda solo si hay un veredicto pendiente con rondas restantes.

    Así recargar o visitar la URL de nuevo no suma rondas de más.
    """
    outcome = session.get("outcome")
    if outcome and outcome["has_next_round"]:
        advance_to_next_round(session)
        return redirect(url_for("game.roles"))
    return redirect(url_for("game.resultado" if outcome else "game.roles"))
