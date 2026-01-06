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
}

// Código para la sala de espera (lobby)
const socket = io();
const roomCode = document.body.dataset.roomCode;
const playerName = document.body.dataset.playerName;
const initialPlayers = JSON.parse(document.body.dataset.players);

socket.emit('join_room', { room_code: roomCode, player_name: playerName });

socket.on('update_players', function(data) {
    updatePlayersList(data.players);
});

// Inicializar con players pasados desde template
updatePlayersList(initialPlayers);