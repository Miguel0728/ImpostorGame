const debateState = {
    players: [],
    currentSpeakerIndex: 0,
    remainingSeconds: 0,
    timerIntervalId: null,
    isFreeTime: false
};

document.addEventListener("DOMContentLoaded", initGameplayPage);

function initGameplayPage() {
    loadGameplayData();
    document.getElementById("btn-next-turn").addEventListener("click", handleNextTurnClick);
    document.getElementById("btn-force-vote").addEventListener("click", handleTimeExpired);
    renderCurrentSpeaker();
    debateState.timerIntervalId = setInterval(tickTimer, 1000);
}

function loadGameplayData() {
    const data = JSON.parse(document.getElementById("gameplay-data").textContent);
    debateState.players = data.players;
    debateState.isFreeTime = data.time_seconds === 0;
    debateState.remainingSeconds = data.time_seconds;
    updateTimerDisplay(data.time_seconds);
    if (debateState.isFreeTime) setStatusLabel("DEBATE LIBRE");
}

function setStatusLabel(text) {
    document.getElementById("timer-status-label").textContent = text;
}

function tickTimer() {
    if (!debateState.isFreeTime && debateState.remainingSeconds <= 1) {
        handleTimeExpired();
        return;
    }
    debateState.remainingSeconds += debateState.isFreeTime ? 1 : -1;
    updateTimerDisplay(debateState.remainingSeconds);
}

function updateTimerDisplay(seconds) {
    const pad = (n) => String(n).padStart(2, "0");
    document.getElementById("clock-display").textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

function handleTimeExpired() {
    clearInterval(debateState.timerIntervalId);
    if (!debateState.isFreeTime) updateTimerDisplay(0);
    applyTimeExpiredUI();
}

function applyTimeExpiredUI() {
    if (debateState.isFreeTime) {
        setStatusLabel("DEBATE FINALIZADO");
    } else {
        document.getElementById("timer-box").classList.add("timer-expired");
        setStatusLabel("¡TIEMPO AGOTADO!");
    }
    switchButtonsForVoting();
}

function switchButtonsForVoting() {
    document.getElementById("btn-next-turn").classList.add("view-hidden");
    document.getElementById("btn-force-vote").classList.add("view-hidden");
    document.getElementById("vote-container").classList.remove("view-hidden");
    document.getElementById("btn-go-to-vote").focus();
}

function handleNextTurnClick() {
    debateState.currentSpeakerIndex = (debateState.currentSpeakerIndex + 1) % debateState.players.length;
    renderCurrentSpeaker();
}

function renderCurrentSpeaker() {
    const player = debateState.players[debateState.currentSpeakerIndex];
    document.getElementById("gameplay-title").textContent = player.name;
    document.getElementById("speaker-index").textContent = String(debateState.currentSpeakerIndex + 1);
    document.getElementById("speaker-number").textContent = String(player.id);
    document.getElementById("speaker-avatar").className = `speaker-avatar color-theme-${player.color_index}`;
}
