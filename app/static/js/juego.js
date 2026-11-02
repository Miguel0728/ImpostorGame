const debateState = {
    players: [],
    currentSpeakerIndex: 0,
    totalSeconds: 0,
    startedAt: 0,
    timerIntervalId: null,
    isFreeTime: false,
    saved: {}
};

document.addEventListener("DOMContentLoaded", initGameplayPage);

function initGameplayPage() {
    if (!loadGameplayData()) return;
    document.getElementById("btn-next-turn").addEventListener("click", handleNextTurnClick);
    document.getElementById("btn-force-vote").addEventListener("click", handleTimeExpired);
    renderCurrentSpeaker();
    debateState.timerIntervalId = setInterval(tickTimer, 1000);
    tickTimer();
}

function loadGameplayData() {
    const state = ModoLocal.loadState();
    if (!ModoLocal.hasGameInProgress(state)) {
        window.location.replace(document.querySelector("[data-config-url]").dataset.configUrl);
        return false;
    }
    const data = ModoLocal.getGameplayData(state);
    state.phase = "debate";
    state.debate = state.debate || { started_at: Date.now(), speaker: 0 };
    ModoLocal.saveState(state);
    debateState.saved = state;
    debateState.players = data.players;
    debateState.isFreeTime = data.time_seconds === 0;
    debateState.totalSeconds = data.time_seconds;
    debateState.startedAt = state.debate.started_at;
    debateState.currentSpeakerIndex = state.debate.speaker % data.players.length;
    document.getElementById("round-current").textContent = String(data.current_round);
    document.getElementById("round-total").textContent = String(data.total_rounds);
    document.getElementById("speaker-total").textContent = String(data.players.length);
    if (debateState.isFreeTime) setStatusLabel("DEBATE LIBRE");
    return true;
}

function setStatusLabel(text) {
    document.getElementById("timer-status-label").textContent = text;
}

function currentSeconds() {
    const elapsed = Math.max(0, Math.floor((Date.now() - debateState.startedAt) / 1000));
    return debateState.isFreeTime ? elapsed : Math.max(0, debateState.totalSeconds - elapsed);
}

function tickTimer() {
    const seconds = currentSeconds();
    updateTimerDisplay(seconds);
    if (!debateState.isFreeTime && seconds <= 0) handleTimeExpired();
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
    debateState.saved.debate.speaker = debateState.currentSpeakerIndex;
    ModoLocal.saveState(debateState.saved);
    renderCurrentSpeaker();
}

function renderCurrentSpeaker() {
    const player = debateState.players[debateState.currentSpeakerIndex];
    document.getElementById("gameplay-title").textContent = player.name;
    document.getElementById("speaker-index").textContent = String(debateState.currentSpeakerIndex + 1);
    document.getElementById("speaker-number").textContent = String(player.id);
    document.getElementById("speaker-avatar").className = `speaker-avatar color-theme-${player.color_index}`;
}
