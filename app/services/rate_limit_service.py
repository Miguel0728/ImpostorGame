import threading
import time

ROOMS_PER_WINDOW = 5
WINDOW_SECONDS = 3600

# Marcas de tiempo de las salas creadas por cada IP; viven en memoria igual que las salas.
_creations = {}
_lock = threading.Lock()


def _prune(now):
    """Olvida las creaciones fuera de la ventana y las IP que ya no tienen ninguna."""
    limit = now - WINDOW_SECONDS
    for key in list(_creations):
        recent = [stamp for stamp in _creations[key] if stamp > limit]
        if recent:
            _creations[key] = recent
        else:
            del _creations[key]


def is_limited(key):
    """Indica si esta IP ya creó el máximo de salas permitido dentro de la ventana."""
    with _lock:
        _prune(time.time())
        return len(_creations.get(key, ())) >= ROOMS_PER_WINDOW


def record_creation(key):
    """Anota que esta IP acaba de crear una sala."""
    with _lock:
        _creations.setdefault(key, []).append(time.time())
