const POLL_MS = 1000;
const MIN_PLAYERS = 3;
const VIEWS = ["join", "lobby", "debate", "voting", "result"];

const VERDICTS = {
    free: { icon: "🏆", kicker: "SOLO PIERDE EL EXPULSADO", title: "¡UN IMPOSTOR FUE EXPULSADO, PERO QUEDAN LIBRES!" },
    caught: { icon: "🏆", kicker: "VICTORIA DE LA TRIPULACIÓN", title: "¡EL IMPOSTOR FUE EXPULSADO!" },
    escaped: { icon: "😈", kicker: "VICTORIA DEL IMPOSTOR", title: "¡EL IMPOSTOR LOGRÓ ENGAÑAR A TODOS!" }
};

const RENDERERS = {
    join: renderJoin,
    lobby: renderLobby,
    debate: renderDebate,
    voting: renderVoting,
    result: renderResult
};

const root = { stateUrl: "", actionUrl: "", homeUrl: "" };

document.addEventListener("DOMContentLoaded", initRoomPage);

function initRoomPage() {
    const dataset = document.getElementById("room-root").dataset;
    Object.assign(root, { stateUrl: dataset.stateUrl, actionUrl: dataset.actionUrl, homeUrl: dataset.homeUrl });
    document.getElementById("join-form").addEventListener("submit", handleJoinSubmit);
    document.getElementById("btn-share").addEventListener("click", handleShareClick);
    document.getElementById("btn-toggle-role").addEventListener("click", toggleRolePanel);
    document.querySelectorAll("[data-action]").forEach(button => {
        button.addEventListener("click", () => sendAction(button.dataset.action));
    });
    refreshState();
    setInterval(refreshState, POLL_MS);
}

async function refreshState() {
    const response = await fetch(root.stateUrl).catch(() => null);
    if (!response) return;
    if (!response.ok) {
        window.location.assign(root.homeUrl);
        return;
    }
    renderState(await response.json());
}

async function sendAction(action, fields = {}) {
    const body = new URLSearchParams({ accion: action, ...fields });
    const response = await fetch(root.actionUrl, { method: "POST", body }).catch(() => null);
    showError(response ? (await response.json()).error : "Sin conexión con el servidor.");
    refreshState();
}

function showError(message) {
    const box = document.getElementById("room-error");
    box.textContent = message || "";
    box.classList.toggle("view-hidden", !message);
}

function handleJoinSubmit(event) {
    event.preventDefault();
    sendAction("unirse", { name: document.getElementById("join-name").value });
}

async function handleShareClick() {
    const data = { title: "El Impostor", text: "Únete a mi sala de El Impostor", url: window.location.href };
    if (navigator.share) {
        await navigator.share(data).catch(() => null);
        return;
    }
    await navigator.clipboard?.writeText(data.url);
    document.getElementById("btn-share-text").textContent = "¡ENLACE COPIADO!";
}

function toggleRolePanel() {
    const hidden = document.getElementById("role-panel").classList.toggle("view-hidden");
    document.getElementById("btn-toggle-role-text").textContent = hidden ? "VER MI ROL" : "OCULTAR MI ROL";
}

function hideRolePanel() {
    document.getElementById("role-panel").classList.add("view-hidden");
    document.getElementById("btn-toggle-role-text").textContent = "VER MI ROL";
}

function renderState(state) {
    const view = state.you ? state.phase : "join";
    VIEWS.forEach(name => document.getElementById(`view-${name}`).classList.toggle("view-hidden", name !== view));
    document.querySelectorAll("[data-for]").forEach(element => {
        element.classList.toggle("view-hidden", element.dataset.for !== (state.you?.is_host ? "host" : "guest"));
    });
    if (view !== "debate") hideRolePanel();
    RENDERERS[view](state);
}

function setText(id, text) {
    document.getElementById(id).textContent = text;
}

function makeElement(tag, className, text = "") {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
}

function makePlayerSlot(player, index) {
    const slot = makeElement("div", `player-slot color-theme-${player.color_index}`);
    slot.setAttribute("role", "listitem");
    const avatar = makeElement("div", "player-avatar");
    avatar.append(makeElement("span", "player-number", String(index + 1)));
    slot.append(avatar, makeElement("span", "roster-name", player.name));
    return slot;
}

function fillIfChanged(containerId, key, buildNodes) {
    const container = document.getElementById(containerId);
    if (container.dataset.key === key) return;
    container.dataset.key = key;
    container.replaceChildren(...buildNodes());
}

function fillRoster(containerId, players) {
    fillIfChanged(containerId, JSON.stringify(players), () => players.map(makePlayerSlot));
}

function renderJoin(state) {
    const isOpen = state.phase === "lobby";
    document.getElementById("join-form").classList.toggle("view-hidden", !isOpen);
    document.getElementById("join-closed").classList.toggle("view-hidden", isOpen);
}

function renderLobby(state) {
    setText("lobby-count", `${state.players.length} de ${state.capacity} jugadores`);
    fillRoster("lobby-players", state.players);
    document.getElementById("btn-start").disabled = state.players.length < MIN_PLAYERS;
}

function formatClock(seconds) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

function renderDebate(state) {
    const role = state.you.role;
    const isFree = state.seconds_left === null;
    setText("debate-round", `RONDA ${state.current_round} DE ${state.total_rounds}`);
    setText("clock-display", isFree ? "--:--" : formatClock(state.seconds_left));
    setText("timer-label", isFree ? "DEBATE LIBRE" : "TIEMPO DE DEBATE");
    setText("role-badge-text", role.role_title);
    setText("secret-word", role.word);
    setText("secret-hint", role.hint);
    document.getElementById("role-badge").className = `role-badge ${role.is_impostor ? "badge-impostor" : "badge-crew"}`;
    fillRoster("debate-players", state.players);
}

function makeVoteOption(player, chosen) {
    const option = makeElement("button", `btn-secondary${player.name === chosen ? " is-chosen" : ""}`);
    option.type = "button";
    option.append(makeElement("span", "btn-text", player.name));
    option.addEventListener("click", () => sendAction("votar", { target: player.name }));
    return option;
}

function renderVoting(state) {
    const chosen = state.you.vote;
    const candidates = state.players.filter(player => player.name !== state.you.name);
    setText("voting-status", `Votos recibidos: ${state.votes_in} de ${state.players.length}. Toca a quien acusas.`);
    fillIfChanged("vote-options", JSON.stringify([candidates, chosen]), () => candidates.map(player => makeVoteOption(player, chosen)));
}

function joinNames(players) {
    return players.map(player => player.name).join(", ");
}

function verdictKey(outcome) {
    if (outcome.free_impostors.length) return "free";
    return outcome.impostor_caught ? "caught" : "escaped";
}

function renderResult(state) {
    const outcome = state.outcome;
    const verdict = VERDICTS[verdictKey(outcome)];
    const hasFree = outcome.free_impostors.length > 0;
    document.getElementById("view-result").classList.toggle("card-crew-win", outcome.impostor_caught);
    document.getElementById("view-result").classList.toggle("card-impostor-win", !outcome.impostor_caught);
    document.getElementById("result-free-box").classList.toggle("view-hidden", !hasFree);
    setText("result-round", `RONDA ${outcome.current_round} DE ${outcome.total_rounds}`);
    setText("result-icon", verdict.icon);
    setText("result-kicker", verdict.kicker);
    setText("result-title", verdict.title);
    setText("result-voted", outcome.most_voted ? `${outcome.most_voted.name} (${outcome.top_votes} votos)` : "Empate / Sin mayoría");
    setText("result-impostors-label", hasFree ? "IMPOSTOR EXPULSADO:" : "IDENTIDAD DEL IMPOSTOR REAL:");
    setText("result-impostors", hasFree ? outcome.most_voted.name : joinNames(outcome.impostors));
    setText("result-free", joinNames(outcome.free_impostors));
    setText("result-word", outcome.secret_word);
    setText("btn-next-text", outcome.has_next_round ? `INICIAR RONDA ${outcome.next_round} DE ${outcome.total_rounds}` : "VOLVER AL LOBBY");
}
