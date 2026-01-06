// ==================== FUNCIONES GLOBALES ====================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) return;
    
    toastMessage.textContent = message;
    toast.className = 'toast';
    
    if (type === 'error') {
        toast.style.borderColor = 'var(--danger)';
    } else {
        toast.style.borderColor = 'var(--success)';
    }
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==================== PÁGINA INDEX ====================

if (document.getElementById('gameCode')) {
    // Convertir código a mayúsculas automáticamente
    document.getElementById('gameCode').addEventListener('input', function() {
        this.value = this.value.toUpperCase();
    });
}

// ==================== PÁGINA LOBBY ====================

if (document.body.dataset.roomCode) {
    const socket = io();
    const roomCode = document.body.dataset.roomCode;
    const playerName = document.body.dataset.playerName;
    const initialPlayers = JSON.parse(document.body.dataset.players || '[]');
    const maxPlayers = parseInt(document.body.dataset.maxPlayers || '6');
    const isHost = JSON.parse(document.body.dataset.isHost || 'false');

    console.log('🎮 Lobby inicializado:', { roomCode, playerName, isHost });

    // Conectar a Socket.IO y unirse a la sala
    socket.on('connect', function() {
        console.log('✓ Conectado a Socket.IO');
        socket.emit('join_room', { 
            room_code: roomCode, 
            player_name: playerName 
        });
    });

    // Escuchar actualizaciones de jugadores
    socket.on('update_players', function(data) {
        console.log('→ Actualización de jugadores:', data);
        updatePlayersList(data.players);
        updatePlayerCount(data.players.length, data.max_players || maxPlayers);
    });

    // Escuchar errores del servidor
    socket.on('error', function(data) {
        console.error('✗ Error del servidor:', data.message);
        showToast(data.message, 'error');
    });

    // Escuchar cambio de host
    socket.on('new_host', function(data) {
        console.log('→ Nuevo host:', data.host);
        if (data.host === playerName) {
            showToast('Ahora eres el anfitrión', 'success');
            showHostControls(true);
        }
    });

    // Escuchar inicio de juego
    socket.on('game_started', function() {
        console.log('✓ Juego iniciado, redirigiendo...');
        showToast('¡El juego ha comenzado!', 'success');
        setTimeout(() => {
            window.location.href = '/game?code=' + roomCode;
        }, 1000);
    });

    // Función para actualizar lista de jugadores
    function updatePlayersList(players) {
        const playersList = document.getElementById('playersList');
        if (!playersList) return;

        playersList.innerHTML = '';
        
        players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            
            const avatar = document.createElement('div');
            avatar.className = 'player-avatar';
            avatar.textContent = player.charAt(0).toUpperCase();
            
            const info = document.createElement('div');
            info.className = 'player-info';
            
            const name = document.createElement('div');
            name.className = 'player-name';
            name.textContent = player;
            
            // Añadir badge de host
            if (index === 0) {
                const badge = document.createElement('span');
                badge.className = 'player-badge';
                badge.textContent = 'HOST';
                name.appendChild(badge);
            }
            
            info.appendChild(name);
            playerDiv.appendChild(avatar);
            playerDiv.appendChild(info);
            playersList.appendChild(playerDiv);
        });
    }

    // Función para actualizar contador
    function updatePlayerCount(current, max) {
        const playerCount = document.getElementById('playerCount');
        if (playerCount) {
            playerCount.textContent = `${current}/${max}`;
        }
    }

    // Función para mostrar/ocultar controles de host
    function showHostControls(show) {
        const hostControls = document.getElementById('hostControls');
        const startGameBtn = document.getElementById('startGameBtn');
        const hostIndicator = document.getElementById('hostIndicator');
        
        if (hostControls) hostControls.style.display = show ? 'block' : 'none';
        if (startGameBtn) startGameBtn.style.display = show ? 'block' : 'none';
        if (hostIndicator) hostIndicator.textContent = show ? 'Eres el anfitrión' : '';
    }

    // Inicializar con jugadores del servidor
    updatePlayersList(initialPlayers);
    updatePlayerCount(initialPlayers.length, maxPlayers);

    // Mostrar controles si es host
    if (isHost) {
        showHostControls(true);
    }

    // Event listener para copiar código
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', function() {
            navigator.clipboard.writeText(roomCode).then(() => {
                showToast('Código copiado al portapapeles', 'success');
            }).catch(() => {
                showToast('No se pudo copiar el código', 'error');
            });
        });
    }

    // Event listener para configuración (solo host)
    if (isHost) {
        const categorySelect = document.getElementById('categorySelect');
        const roundTime = document.getElementById('roundTime');
        
        if (categorySelect) {
            categorySelect.addEventListener('change', function() {
                socket.emit('update_config', {
                    room_code: roomCode,
                    category: this.value
                });
                console.log('→ Categoría actualizada:', this.value);
            });
        }
        
        if (roundTime) {
            roundTime.addEventListener('change', function() {
                socket.emit('update_config', {
                    room_code: roomCode,
                    round_time: parseInt(this.value)
                });
                console.log('→ Tiempo de ronda actualizado:', this.value);
            });
        }
    }

    // Event listener para iniciar juego
    const startGameBtn = document.getElementById('startGameBtn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', function() {
            const currentPlayers = document.querySelectorAll('.player-item').length;
            
            if (currentPlayers < 3) {
                showToast('Se necesitan al menos 3 jugadores', 'error');
                return;
            }
            
            console.log('→ Iniciando juego...');
            this.disabled = true;
            this.textContent = 'Iniciando...';
            
            socket.emit('start_game', { room_code: roomCode });
        });
    }

    // Event listener para salir de la sala
    const leaveGameBtn = document.getElementById('leaveGameBtn');
    if (leaveGameBtn) {
        leaveGameBtn.addEventListener('click', function() {
            if (confirm('¿Seguro que quieres salir de la sala?')) {
                socket.emit('leave_room', {
                    room_code: roomCode,
                    player_name: playerName
                });
                window.location.href = '/';
            }
        });
    }

    // Detectar cierre de ventana
    window.addEventListener('beforeunload', function() {
        socket.emit('leave_room', {
            room_code: roomCode,
            player_name: playerName
        });
    });
}

// ==================== PÁGINA GAME ====================

if (document.getElementById('gameRoomCode')) {
    console.log('🎮 Página de juego cargada');
    
    // Aquí irá la lógica del juego cuando la implementes
    const endGameBtn = document.getElementById('endGameBtn');
    if (endGameBtn) {
        endGameBtn.addEventListener('click', function() {
            if (confirm('¿Seguro que quieres terminar la partida?')) {
                window.location.href = '/';
            }
        });
    }
}