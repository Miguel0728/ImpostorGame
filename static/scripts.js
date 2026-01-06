document.getElementById('leaveGameBtn').addEventListener('click', function() {
    window.location.href = '/';  // Redirige a la página principal
});

// Función para actualizar la lista de jugadores
function updatePlayersList(players) {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        playerDiv.textContent = player;
        playersList.appendChild(playerDiv);
    });
    // Update player count
    const maxPlayers = document.body.dataset.maxPlayers;
    document.getElementById('playerCount').textContent = players.length + '/' + maxPlayers;
}

// Función para mostrar toast
function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Código para la sala de espera (lobby)
const socket = io();
const roomCode = document.body.dataset.roomCode;
const playerName = document.body.dataset.playerName;
const initialPlayers = JSON.parse(document.body.dataset.players);
const isHost = JSON.parse(document.body.dataset.isHost);

socket.emit('join_room', { room_code: roomCode, player_name: playerName });

socket.on('update_players', function(data) {
    updatePlayersList(data.players);
});

// Inicializar con players pasados desde template
updatePlayersList(initialPlayers);

// Mostrar controles de host si es host
if (isHost) {
    document.getElementById('hostControls').style.display = 'block';
    document.getElementById('startGameBtn').style.display = 'block';
    document.getElementById('hostIndicator').textContent = 'Eres el anfitrión';
}

// Event listener para copiar código
document.getElementById('copyCodeBtn').addEventListener('click', function() {
    navigator.clipboard.writeText(roomCode).then(() => {
        showToast('Código copiado al portapapeles');
    });
});

// Event listener para iniciar juego
document.getElementById('startGameBtn').addEventListener('click', function() {
    socket.emit('start_game', { room_code: roomCode });
});

// Escuchar inicio de juego
socket.on('game_started', function() {
    window.location.href = '/game?code=' + roomCode;
});