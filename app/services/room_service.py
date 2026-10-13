import math
import random
import secrets
import time

from app.services.game_service import (
    MIN_PLAYERS,
    advance_to_next_round,
    clear_round_state,
    color_index_for,
    get_round_info,
    initialize_new_game,
    max_impostors_for,
    resolve_voting_outcome,
    validate_player_names
)

ROOM_CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"
ROOM_CODE_LENGTH = 4
ROOM_TTL_SECONDS = 6 * 3600

# Las salas viven en memoria: el servidor debe ejecutarse con un único worker.
ROOMS = {}


def new_token():
    """Genera el identificador privado con el que un navegador se reconoce dentro de una sala."""
    return secrets.token_urlsafe(8)


def _new_code():
    """Genera un código de sala corto que no esté en uso."""
    while True:
        code = "".join(random.choices(ROOM_CODE_LETTERS, k=ROOM_CODE_LENGTH))
        if code not in ROOMS:
            return code


def _purge_expired_rooms():
    """Elimina las salas sin actividad reciente para no acumular memoria."""
    limit = time.time() - ROOM_TTL_SECONDS
    for code in [c for c, room in ROOMS.items() if room["touched"] < limit]:
        del ROOMS[code]


def create_room(config):
    """Crea una sala en el lobby con la configuración ya validada; retorna (código, token del anfitrión)."""
    _purge_expired_rooms()
    code, host = _new_code(), new_token()
    ROOMS[code] = {
        "config": config,
        "players": [],
        "tokens": [],
        "host": host,
        "phase": "lobby",
        "current_round": 1,
        "touched": time.time()
    }
    return code, host


def get_room(code):
    """Busca una sala por su código (sin distinguir mayúsculas) y renueva su actividad."""
    room = ROOMS.get(code.upper())
    if room:
        room["touched"] = time.time()
    return room


def _guard(room, token, phase, host_only):
    """Retorna el motivo por el que una acción no procede ahora o None si está permitida."""
    if token not in room["tokens"]:
        return "No estás en esta sala."
    if room["phase"] != phase:
        return "Esa acción no está disponible en este momento."
    if host_only and token != room["host"]:
        return "Solo el anfitrión puede hacerlo."
    return None


def _act_join(room, token, form):
    """Añade al jugador al lobby con un nombre válido y distinto de los demás."""
    if token in room["tokens"]:
        return None
    if room["phase"] != "lobby":
        return "La partida ya comenzó."
    if len(room["players"]) >= room["config"]["players"]:
        return "La sala está llena."
    names, error = validate_player_names(room["players"] + [form.get("name", "")], len(room["players"]) + 1)
    if error:
        return error
    room["players"].append(names[-1])
    room["tokens"].append(token)
    return None


def _begin_debate(room):
    """Abre la fase de debate y fija su hora límite si la partida tiene tiempo."""
    seconds = room["config"]["time_seconds"]
    room.update(phase="debate", votes={}, deadline=time.time() + seconds if seconds else None)


def _act_start(room, token, form):
    """El anfitrión reparte roles con los jugadores presentes y abre el debate."""
    error = _guard(room, token, "lobby", True)
    if error:
        return error
    if len(room["players"]) < MIN_PLAYERS:
        return f"Se necesitan al menos {MIN_PLAYERS} jugadores."
    config = room["config"]
    config["impostors"] = min(config["impostors"], max_impostors_for(len(room["players"])))
    initialize_new_game(room)
    _begin_debate(room)
    return None


def _act_end_debate(room, token, form):
    """El anfitrión cierra el debate y abre la votación."""
    error = _guard(room, token, "debate", True)
    if not error:
        room["phase"] = "voting"
    return error


def _reveal(room):
    """Cuenta los votos emitidos y publica el veredicto de la ronda."""
    room["outcome"] = resolve_voting_outcome(room, list(room["votes"].values()))
    room["phase"] = "result"


def _act_vote(room, token, form):
    """Registra el voto de un jugador; el veredicto sale cuando todos han votado."""
    error = _guard(room, token, "voting", False)
    if error:
        return error
    target = form.get("target")
    if target not in room["players"] or target == room["players"][room["tokens"].index(token)]:
        return "Elige a otro jugador."
    room["votes"][token] = target
    if len(room["votes"]) == len(room["tokens"]):
        _reveal(room)
    return None


def _act_reveal(room, token, form):
    """El anfitrión fuerza el veredicto con los votos recibidos hasta ahora."""
    error = _guard(room, token, "voting", True)
    if not error:
        _reveal(room)
    return error


def _act_next(room, token, form):
    """El anfitrión inicia la siguiente ronda o, tras la última, devuelve a todos al lobby."""
    error = _guard(room, token, "result", True)
    if error:
        return error
    if room["outcome"]["has_next_round"]:
        advance_to_next_round(room)
        _begin_debate(room)
    else:
        clear_round_state(room)
        room.update(phase="lobby", current_round=1, votes={})
    return None


ACTIONS = {
    "unirse": _act_join,
    "iniciar": _act_start,
    "cerrar_debate": _act_end_debate,
    "votar": _act_vote,
    "revelar": _act_reveal,
    "siguiente": _act_next
}


def apply_action(room, token, action, form):
    """Ejecuta una acción de un jugador sobre la sala; retorna un mensaje de error o None."""
    handler = ACTIONS.get(action)
    return handler(room, token, form) if handler else "Acción desconocida."


def _close_debate_if_expired(room):
    """Pasa a votación cuando se agota el tiempo del debate."""
    deadline = room.get("deadline")
    if room["phase"] == "debate" and deadline and time.time() >= deadline:
        room["phase"] = "voting"


def _seconds_left(room):
    """Segundos restantes del debate; None si no corre un reloj."""
    deadline = room.get("deadline")
    if room["phase"] != "debate" or not deadline:
        return None
    return max(0, math.ceil(deadline - time.time()))


def _describe_player(room, token):
    """Datos privados del jugador que consulta: su rol solo se envía a él."""
    if token not in room["tokens"]:
        return None
    index = room["tokens"].index(token)
    return {
        "name": room["players"][index],
        "is_host": token == room["host"],
        "vote": room.get("votes", {}).get(token),
        "role": room["roles"][index] if room["phase"] != "lobby" else None
    }


def build_room_state(room, token):
    """Estado de la sala visto por un jugador, listo para enviarse como JSON."""
    _close_debate_if_expired(room)
    return {
        "phase": room["phase"],
        "capacity": room["config"]["players"],
        "players": [{"name": n, "color_index": color_index_for(i)} for i, n in enumerate(room["players"])],
        "you": _describe_player(room, token),
        "seconds_left": _seconds_left(room),
        "votes_in": len(room.get("votes", {})),
        "outcome": room.get("outcome") if room["phase"] == "result" else None,
        **get_round_info(room)
    }
