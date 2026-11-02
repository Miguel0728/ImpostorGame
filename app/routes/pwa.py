import hashlib
import json
import os
from pathlib import Path

from flask import Blueprint, Response, abort, current_app, jsonify, render_template, send_from_directory, url_for
from app.services.game_service import WORDS_FILE

pwa_bp = Blueprint("pwa", __name__)

SERVICE_WORKER_FILE = "js/service-worker.js"
PRECACHE_FOLDERS = ("css", "js", "img")
PRECACHE_PAGES = (
    "home.index", "game.configurar", "game.jugadores", "game.roles",
    "game.juego", "game.votacion", "game.resultado", "home.privacidad", "pwa.offline"
)


def _static_files():
    """Archivos de static/ que se guardan al instalar la app (sin el propio service worker ni archivos con espacios)."""
    static = Path(current_app.static_folder)
    files = (path for folder in PRECACHE_FOLDERS for path in sorted((static / folder).rglob("*")) if path.is_file())
    relative = (path.relative_to(static).as_posix() for path in files)
    return [name for name in relative if " " not in name and name != SERVICE_WORKER_FILE]


def _cache_version(static_files):
    """Huella de todo lo que se precarga: si algo cambia, el service worker pasa a otra caché automáticamente."""
    static = Path(current_app.static_folder)
    templates = sorted(Path(current_app.root_path, "templates").rglob("*.html"))
    watched = [static / name for name in static_files] + templates + [static / "manifest.webmanifest", WORDS_FILE]
    digest = hashlib.sha1()
    for path in watched:
        stat = path.stat()
        digest.update(f"{path.name}:{stat.st_mtime_ns}:{stat.st_size}".encode())
    return digest.hexdigest()[:10]


@pwa_bp.route("/service-worker.js")
def service_worker():
    """Entrega el service worker desde la raíz (alcance total) con la lista de archivos y la versión de caché."""
    static_files = _static_files()
    urls = [url_for("static", filename=name) for name in static_files]
    urls += [url_for(endpoint) for endpoint in PRECACHE_PAGES]
    urls += [url_for("game.palabras"), url_for("pwa.manifest")]
    header = (
        f"const CACHE_VERSION = {json.dumps(_cache_version(static_files))};\n"
        f"const PRECACHE_URLS = {json.dumps(urls)};\n"
        f"const OFFLINE_URL = {json.dumps(url_for('pwa.offline'))};\n\n"
    )
    source = (Path(current_app.static_folder) / SERVICE_WORKER_FILE).read_text(encoding="utf-8")
    response = Response(header + source, mimetype="text/javascript")
    response.headers["Cache-Control"] = "no-cache"
    return response


@pwa_bp.route("/manifest.webmanifest")
def manifest():
    """Manifest de la app instalable."""
    return send_from_directory(current_app.static_folder, "manifest.webmanifest", mimetype="application/manifest+json")


@pwa_bp.route("/.well-known/assetlinks.json")
def asset_links():
    """Vincula este sitio con la app de Android para que se abra sin la barra del navegador.

    Se configura con ANDROID_PACKAGE_NAME y ANDROID_SHA256_FINGERPRINTS (varias, separadas por comas).
    Mientras falte alguna, la ruta responde 404.
    """
    package = os.environ.get("ANDROID_PACKAGE_NAME", "").strip()
    fingerprints = [item.strip() for item in os.environ.get("ANDROID_SHA256_FINGERPRINTS", "").split(",") if item.strip()]
    if not package or not fingerprints:
        abort(404)
    return jsonify([{
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {"namespace": "android_app", "package_name": package, "sha256_cert_fingerprints": fingerprints}
    }])


@pwa_bp.route("/offline")
def offline():
    """Página que se muestra al abrir una sala online sin conexión."""
    return render_template("pwa/offline.html")
