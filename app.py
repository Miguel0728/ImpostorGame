from flask import Flask, render_template, request, redirect, url_for, session
from flask_socketio import SocketIO, join_room, emit
import random
import string

app = Flask(__name__)
app.secret_key = 'tu_clave_secreta_aqui'  # Cambia por una clave segura
socketio = SocketIO(app, cors_allowed_origins="*")  # Habilitar WebSockets


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
    if room_code and room_code in rooms:
        players = rooms[room_code]['players']
        return render_template('lobby.html', room_code=room_code, players=players)
    return redirect(url_for('index'))

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
    session['player_name'] = host_name
    print(f"Sala creada: {room_code} por {host_name}")  # Log para depurar
    return redirect(url_for('lobby', code=room_code))


@app.route('/join_game', methods=['POST'])
def join_game():
    player_name = request.form.get('playerName')
    # Añadimos .strip() para eliminar espacios accidentales
    game_code = request.form.get('gameCode').strip().upper() 
    
    print(f"Intento de unión: Jugador={player_name}, Código={game_code}") # Log de depuración
    print(f"Salas activas: {list(rooms.keys())}") # Ver qué salas existen realmente en memoria

    if validate_code(game_code):
        rooms[game_code]['players'].append(player_name)
        session['player_name'] = player_name
        return redirect(url_for('lobby', code=game_code))
    else:
        print(f"Error: La sala {game_code} no existe o está llena")
        return redirect(url_for('index'))

def validate_code(code):
    # Asegúrate de que comparas strings correctamente
    return code in rooms and len(rooms[code]['players']) < rooms[code]['max_players']

# Eventos de Socket.IO
@socketio.on('join_room')
def handle_join_room(data):
    room_code = data['room_code']
    player_name = data['player_name']
    join_room(room_code)
    emit('update_players', {'players': rooms[room_code]['players']}, room=room_code)

@socketio.on('start_game')
def handle_start_game(data):
    room_code = data['room_code']
    # Lógica para iniciar el juego (asignar roles, etc.)
    emit('game_started', room=room_code)

# Funciones auxiliares (implementa según necesidad)
def generate_room_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase, k=6))
        if code not in rooms:
            return code

def validate_code(code):
  return code in rooms and len(rooms[code]['players']) < rooms[code]['max_players']

if __name__ == '__main__':
    socketio.run(app, debug=True)