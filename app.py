from flask import Flask, render_template, request, redirect, url_for
import random
import string

app = Flask(__name__)
# socketio = SocketIO(app)  # Si necesitas WebSockets para el juego


rooms = {}  # Almacena las salas de juego en memoria (puedes usar base de datos)

@app.route('/')
def index():
    """Página principal: muestra formulario para crear o unirse a partida."""
    return render_template('index.html')

@app.route('/lobby')
def lobby():
    """Sala de espera: muestra lista de jugadores y configuración (solo para host)."""
    # Aquí puedes pasar datos dinámicos, como room_code desde query params o sesión
    room_code = request.args.get('code')  # Ej: /lobby?code=ABC123
    return render_template('lobby.html', room_code=room_code)

@app.route('/game')
def game():
    """Página del juego: muestra roles, votación y acciones."""
    # Similar, pasa datos como room_code
    room_code = request.args.get('code')
    return render_template('game.html', room_code=room_code)

@app.route('/create_game', methods=['POST'])
def create_game():
    host_name = request.form.get('hostName')
    max_players = int(request.form.get('maxPlayers'))
    room_code = generate_room_code()
    rooms[room_code] = {'host': host_name, 'max_players': max_players, 'players': [host_name]}
    print(f"Sala creada: {room_code} por {host_name}")  # Log para depurar
    return redirect(url_for('lobby', code=room_code))


@app.route('/join_game', methods=['POST'])
def join_game():
    """Maneja unión a partida desde index.html (formulario joinGameForm)."""
    player_name = request.form.get('playerName')
    game_code = request.form.get('gameCode').upper()
    # Lógica: validar código, agregar jugador, redirigir a lobby
    if validate_code(game_code):
        return redirect(url_for('lobby', code=game_code))
    else:
        return redirect(url_for('index'))  # O mostrar error

# Funciones auxiliares (implementa según necesidad)
def generate_room_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase, k=6))
        if code not in rooms:
            return code

def validate_code(code):
  return code in rooms and len(rooms[code]['players']) < rooms[code]['max_players']

if __name__ == '__main__':
    app.run(debug=True)
    # socketio.run(app)  # Si usas Socket.IO