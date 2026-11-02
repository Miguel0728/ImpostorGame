import os

if __name__ == "__main__":
    # Ejecutar este archivo directamente es el modo de desarrollo; en producción se usa gunicorn.
    os.environ.setdefault("FLASK_DEBUG", "1")

from app import create_app

app = create_app()


def start_server():
    """Inicia el servidor web en modo de desarrollo."""
    app.run(host="0.0.0.0", port=5000, debug=True)


if __name__ == "__main__":
    start_server()
