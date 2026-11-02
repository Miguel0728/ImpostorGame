const CARD_IDS = ["card-privacy", "card-secret", "card-finished"];

const gameState = {
    currentIndex: 0,
    roles: [],
    hasInteracted: false,
    saved: {}
};

document.addEventListener("DOMContentLoaded", initRolesPage);

async function initRolesPage() {
    const state = ModoLocal.loadState();
    if (!ModoLocal.hasGameInProgress(state)) {
        window.location.replace(document.querySelector("[data-config-url]").dataset.configUrl);
        return;
    }
    if (!state.roles) {
        const words = await ModoLocal.loadWords(document.body.dataset.wordsUrl);
        ModoLocal.getStoredRoles(state, words);
    }
    state.phase = "roles";
    ModoLocal.saveState(state);
    gameState.saved = state;
    gameState.roles = state.roles;
    gameState.currentIndex = Math.min(state.reveal_index || 0, gameState.roles.length);
    document.getElementById("progress-total").textContent = String(gameState.roles.length);
    document.getElementById("btn-reveal-role").addEventListener("click", handleRevealClick);
    document.getElementById("btn-hide-and-next").addEventListener("click", handleNextClick);
    renderCurrentStep();
}

function getCurrentPlayer() {
    return gameState.roles[gameState.currentIndex];
}

function renderCurrentStep() {
    if (gameState.currentIndex < gameState.roles.length) {
        renderPrivacyStep();
    } else {
        showFinishedStep();
    }
}

function renderPrivacyStep() {
    const player = getCurrentPlayer();
    document.getElementById("progress-current").textContent = String(gameState.currentIndex + 1);
    document.getElementById("privacy-player-name").textContent = player.name;
    document.getElementById("privacy-number").textContent = String(player.id);
    document.getElementById("privacy-avatar").className = `avatar-ring color-theme-${player.color_index}`;
    showCard("card-privacy");
}

function handleRevealClick() {
    gameState.hasInteracted = true;
    renderSecretStep();
}

function renderSecretStep() {
    const player = getCurrentPlayer();
    const isLast = gameState.currentIndex >= gameState.roles.length - 1;
    document.getElementById("secret-player-title").textContent = player.name;
    document.getElementById("secret-word").textContent = player.word;
    document.getElementById("secret-hint").textContent = player.hint;
    document.getElementById("role-badge-text").textContent = player.role_title;
    document.getElementById("role-badge").className = `role-badge ${player.is_impostor ? "badge-impostor" : "badge-player"}`;
    document.getElementById("btn-hide-text").textContent = isLast ? "FINALIZAR ENTREGA DE ROLES" : "OCULTAR Y PASAR TELÉFONO";
    showCard("card-secret");
}

function handleNextClick() {
    gameState.currentIndex += 1;
    gameState.saved.reveal_index = gameState.currentIndex;
    ModoLocal.saveState(gameState.saved);
    renderCurrentStep();
}

function showFinishedStep() {
    document.getElementById("pass-progress-container").classList.add("view-hidden");
    showCard("card-finished");
}

function showCard(activeCardId) {
    CARD_IDS.forEach(id => document.getElementById(id).classList.toggle("view-hidden", id !== activeCardId));
    const target = document.getElementById(activeCardId).querySelector(".btn-primary, .btn-secondary");
    if (gameState.hasInteracted) target.focus();
}
