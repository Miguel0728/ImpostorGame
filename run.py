from app import create_app

app = create_app()


def start_server():
    """Inicia el servidor web en modo de desarrollo."""
    app.run(host="0.0.0.0", port=5000, debug=True)


if __name__ == "__main__":
    start_server()
