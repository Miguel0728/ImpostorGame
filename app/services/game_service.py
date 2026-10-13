import random
from collections import Counter

MIN_PLAYERS, MAX_PLAYERS = 3, 12
MAX_NAME_LENGTH = 16
MIN_CUSTOM_WORDS = 3
ALLOWED_ROUNDS = (1, 2, 3, 5)
ALLOWED_TIMES = (0, 60, 90, 120)
COLOR_COUNT = 6
ROUND_STATE_KEYS = ("roles", "secret_word", "outcome")

DEFAULT_SETTINGS = {
    "players": 4,
    "impostors": 1,
    "rounds": 3,
    "time_seconds": 120,
    "category": "lugares",
    "custom_words": ""
}

CATEGORIES = [
    {"id": "lugares", "name": "Lugares del Mundo"},
    {"id": "comida", "name": "Comidas y Bebidas"},
    {"id": "objetos", "name": "Objetos Cotidianos"},
    {"id": "profesiones", "name": "Profesiones"},
    {"id": "personalizada", "name": "Palabras Propias"}
]

WORDS = {
    "lugares": ["Aeropuerto", "Playa", "Hospital", "Submarino", "Estación Espacial", "Museo", "Castillo"],
    "comida": ["Pizza", "Hamburguesa", "Sushi", "Tacos", "Chocolate", "Helado", "Paella"],
    "objetos": ["Guitarra", "Telescopio", "Reloj", "Brújula", "Espejo", "Cámara", "Linterna"],
    "profesiones": ["Astronauta", "Detective", "Piloto", "Cocinero", "Cirujano", "Bombero", "Científico"]
}


def get_available_categories():
    """Retorna la lista de categorías temáticas predefinidas."""
    return CATEGORIES


def get_game_configuration(session_obj):
    """Recupera la configuración actual o los valores por defecto."""
    return session_obj.get("config", dict(DEFAULT_SETTINGS))


def color_index_for(index):
    """Asigna un color de la paleta de tripulantes a partir de la posición del jugador."""
    return (index % COLOR_COUNT) + 1


def max_impostors_for(players):
    """Máximo de impostores permitido: 1 hasta 5 jugadores, 2 desde 6 y 3 desde 9."""
    return 1 + (players >= 6) + (players >= 9)


def _form_int(form_data, key):
    """Lee un entero del formulario; si falta o no es numérico usa el valor por defecto."""
    try:
        return int(str(form_data.get(key)).strip())
    except ValueError:
        return DEFAULT_SETTINGS[key]


def _clamp(value, low, high):
    return max(low, min(high, value))


def _nearest(value, allowed):
    return min(allowed, key=lambda option: abs(option - value))


def parse_custom_words(raw_text):
    """Separa las palabras propias por comas, sin vacías ni repetidas (sin distinguir mayúsculas)."""
    unique = {}
    for word in raw_text.split(","):
        clean = " ".join(word.split())
        if clean:
            unique.setdefault(clean.casefold(), clean)
    return list(unique.values())


def build_configuration(form_data):
    """Convierte el formulario en una configuración válida y acotada a los rangos permitidos."""
    players = _clamp(_form_int(form_data, "players"), MIN_PLAYERS, MAX_PLAYERS)
    category = form_data.get("category")
    return {
        "players": players,
        "impostors": _clamp(_form_int(form_data, "impostors"), 1, max_impostors_for(players)),
        "rounds": _nearest(_form_int(form_data, "rounds"), ALLOWED_ROUNDS),
        "time_seconds": _nearest(_form_int(form_data, "time_seconds"), ALLOWED_TIMES),
        "category": category if category in {c["id"] for c in CATEGORIES} else DEFAULT_SETTINGS["category"],
        "custom_words": form_data.get("custom_words", "").strip()
    }


def validate_configuration(config):
    """Retorna un mensaje de error si la configuración no se puede jugar; None si es válida."""
    if config["category"] == "personalizada" and len(parse_custom_words(config["custom_words"])) < MIN_CUSTOM_WORDS:
        return f"Escribe al menos {MIN_CUSTOM_WORDS} palabras distintas separadas por comas."
    return None


def clear_round_state(session_obj):
    """Elimina roles, palabra y veredicto de la ronda anterior."""
    for key in ROUND_STATE_KEYS:
        session_obj.pop(key, None)


def save_configuration(session_obj, config):
    """Guarda la configuración validada y reinicia la partida desde la ronda 1."""
    clear_round_state(session_obj)
    session_obj["config"] = config
    session_obj["current_round"] = 1


def generate_player_slots(player_count, names=None):
    """Genera los espacios para nombrar a los jugadores, conservando nombres ya escritos."""
    names = names or []
    return [
        {
            "id": i + 1,
            "placeholder": names[i] if i < len(names) else f"Tripulante {i + 1}",
            "color_index": color_index_for(i)
        }
        for i in range(player_count)
    ]


def _names_error(names, expected_count):
    """Retorna el primer problema de los nombres (vacíos, largos o repetidos) o None."""
    if len(names) != expected_count or not all(names):
        return "Todos los jugadores necesitan un nombre."
    if any(len(name) > MAX_NAME_LENGTH for name in names):
        return f"Los nombres admiten hasta {MAX_NAME_LENGTH} caracteres."
    if len({name.casefold() for name in names}) != len(names):
        return "Hay nombres repetidos. Cada jugador necesita un nombre distinto."
    return None


def validate_player_names(names_list, expected_count):
    """Normaliza los nombres y retorna (nombres_limpios, mensaje_de_error o None)."""
    cleaned = [" ".join(name.split()) for name in names_list]
    return cleaned, _names_error(cleaned, expected_count)


def save_player_names(session_obj, names_list):
    """Guarda la lista final de nombres de jugadores en la sesión."""
    session_obj["players"] = list(names_list)


def get_player_names(session_obj):
    """Obtiene los nombres guardados o genera nombres por defecto."""
    count = get_game_configuration(session_obj)["players"]
    return session_obj.get("players", [f"Tripulante {i + 1}" for i in range(count)])


def pick_secret_word(category_id, custom_words_str):
    """Selecciona una palabra aleatoria de la categoría o de las palabras propias."""
    custom = parse_custom_words(custom_words_str) if category_id == "personalizada" else []
    return random.choice(custom or WORDS.get(category_id, WORDS["lugares"]))


def build_player_role_payload(index, name, is_impostor, secret_word):
    """Construye el objeto de rol para un tripulante o impostor."""
    return {
        "id": index + 1,
        "name": name,
        "color_index": color_index_for(index),
        "is_impostor": is_impostor,
        "role_title": "IMPOSTOR" if is_impostor else "TRIPULANTE",
        "word": "???" if is_impostor else secret_word,
        "hint": "Finge conocer la palabra secreta" if is_impostor else "Descubre quién finge conocer la palabra"
    }


def initialize_new_game(session_obj):
    """Inicializa una nueva partida sorteando la palabra y roles una única vez."""
    config = get_game_configuration(session_obj)
    names = get_player_names(session_obj)
    word = pick_secret_word(config["category"], config.get("custom_words", ""))
    impostor_indices = set(random.sample(range(len(names)), min(config["impostors"], len(names) - 1)))
    roles = [build_player_role_payload(i, name, i in impostor_indices, word) for i, name in enumerate(names)]
    session_obj["roles"] = roles
    session_obj["secret_word"] = word
    return roles


def get_stored_roles(session_obj):
    """Obtiene los roles previamente generados sin volver a sortear la palabra."""
    if "roles" in session_obj and "secret_word" in session_obj:
        return session_obj["roles"]
    return initialize_new_game(session_obj)


def tally_votes(raw_votes):
    """Cuenta la cantidad de votos recibidos por cada nombre de jugador."""
    return dict(Counter(vote for vote in raw_votes if vote))


def find_most_voted_role(roles, vote_counts):
    """Identifica el jugador con mayoría de votos; si hay empate en el primer lugar, no hay mayoría."""
    if not vote_counts:
        return None, 0
    top_votes = max(vote_counts.values())
    leaders = [name for name, total in vote_counts.items() if total == top_votes]
    if len(leaders) > 1:
        return None, top_votes
    return next((r for r in roles if r["name"] == leaders[0]), None), top_votes


def split_free_impostors(impostors, most_voted):
    """Separa a los impostores que siguen libres: solo pierde el que fue expulsado."""
    return [imp for imp in impostors if imp["id"] != most_voted["id"]]


def get_round_info(session_obj):
    """Retorna la ronda actual, el total y si queda una ronda siguiente."""
    current = session_obj.get("current_round", 1)
    total = get_game_configuration(session_obj)["rounds"]
    return {
        "current_round": current,
        "total_rounds": total,
        "has_next_round": current < total,
        "next_round": current + 1
    }


def summarize_impostors(roles, most_voted):
    """Indica si se expulsó a un impostor y cuáles siguen libres."""
    impostors = [r for r in roles if r["is_impostor"]]
    caught = bool(most_voted and most_voted["is_impostor"])
    return {
        "impostor_caught": caught,
        "impostors": impostors,
        "free_impostors": split_free_impostors(impostors, most_voted) if caught else []
    }


def resolve_voting_outcome(session_obj, raw_votes):
    """Determina si la tripulación descubrió al impostor o si este escapó."""
    roles = get_stored_roles(session_obj)
    most_voted, top_votes = find_most_voted_role(roles, tally_votes(raw_votes))
    return {
        "most_voted": most_voted,
        "top_votes": top_votes,
        "secret_word": session_obj.get("secret_word", "Desconocida"),
        **summarize_impostors(roles, most_voted),
        **get_round_info(session_obj)
    }


def advance_to_next_round(session_obj):
    """Incrementa la ronda y genera una nueva palabra y roles para la partida."""
    current = session_obj.get("current_round", 1)
    clear_round_state(session_obj)
    session_obj["current_round"] = current + 1
    return initialize_new_game(session_obj)


def get_gameplay_data(session_obj):
    """Estructura la información necesaria para la fase activa de debate."""
    names = get_player_names(session_obj)
    return {
        "players": [{"id": i + 1, "name": n, "color_index": color_index_for(i)} for i, n in enumerate(names)],
        "time_seconds": get_game_configuration(session_obj)["time_seconds"],
        **get_round_info(session_obj)
    }
