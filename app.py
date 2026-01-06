import json
from flask import Flask, render_template, request, redirect, url_for, session, flash
from flask_socketio import SocketIO, join_room, emit
import random
import string

app = Flask(__name__)
app.secret_key = 'tu_clave_secreta_aqui'  # Cambia por una clave segura
socketio = SocketIO(app, cors_allowed_origins="*")  # Habilitar WebSockets

ROOMS_FILE = 'rooms.json'

def load_rooms():
    try:
        with open(ROOMS_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_rooms():
    with open(ROOMS_FILE, 'w') as f:
        json.dump(rooms, f)

rooms = load_rooms()  # Cargar salas al iniciar

@app.route('/')
def index():
    """Página principal: muestra formulario para crear o unirse a partida."""
    return render_template('index.html')

@app.route('/lobby')
def lobby():
    """Sala de espera: muestra lista de jugadores y configuración (solo para host)."""
    room_code = request.args.get('code')
    if room_code and room_code in rooms:
        players = rooms[room_code]['players']
        max_players = rooms[room_code]['max_players']
        is_host = session.get('player_name') == rooms[room_code]['host']
        return render_template('lobby.html', room_code=room_code, players=players, max_players=max_players, is_host=is_host)
    return redirect(url_for('index'))

@app.route('/game')
def game():
    """Página del juego: muestra roles, votación y acciones."""
    room_code = request.args.get('code')
    return render_template('game.html', room_code=room_code)

@app.route('/create_game', methods=['POST'])
def create_game():
    host_name = request.form.get('hostName')
    max_players = int(request.form.get('maxPlayers'))
    room_code = generate_room_code()
    rooms[room_code] = {'host': host_name, 'max_players': max_players, 'players': [host_name]}
    save_rooms()  # Guardar salas
    session['player_name'] = host_name
    print(f"Sala creada: {room_code} por {host_name}")
    return redirect(url_for('lobby', code=room_code))

@app.route('/join_game', methods=['POST'])
def join_game():
    player_name = request.form.get('playerName')
    game_code = request.form.get('gameCode').strip().upper()
    
    print(f"Intento de unión: Jugador={player_name}, Código={game_code}")
    print(f"Salas activas: {list(rooms.keys())}")
    
    if validate_code(game_code):
        rooms[game_code]['players'].append(player_name)
        save_rooms()  # Guardar salas
        session['player_name'] = player_name
        return redirect(url_for('lobby', code=game_code))
    else:
        flash('Código de sala inválido o sala llena.')
        return redirect(url_for('index'))

def validate_code(code):
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
    emit('game_started', room=room_code)

def generate_room_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase, k=6))
        if code not in rooms:
            return code

if __name__ == '__main__':
    socketio.run(app, debug=True)