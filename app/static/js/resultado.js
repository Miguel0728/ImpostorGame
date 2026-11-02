const VERDICTS = {
    free: { icon: "🏆", kicker: "SOLO PIERDE EL DESCUBIERTO", title: "¡UN IMPOSTOR FUE DESCUBIERTO, PERO QUEDAN LIBRES!" },
    caught: { icon: "🏆", kicker: "VICTORIA DE LOS JUGADORES", title: "¡DESCUBRIERON AL IMPOSTOR!" },
    escaped: { icon: "😈", kicker: "VICTORIA DEL IMPOSTOR", title: "¡EL IMPOSTOR LOGRÓ ENGAÑAR A TODOS!" }
};

const page = { root: null };

document.addEventListener("DOMContentLoaded", initResultPage);

function initResultPage() {
    page.root = document.querySelector(".result-viewport");
    const state = ModoLocal.loadState();
    if (!state.outcome) {
        window.location.replace(page.root.dataset.homeUrl);
        return;
    }
    state.phase = "result";
    ModoLocal.saveState(state);
    renderOutcome(state.outcome);
    document.getElementById("btn-next-round").addEventListener("click", handleNextRound);
    document.getElementById("btn-exit").addEventListener("click", () => ModoLocal.clearGame());
}

function setText(id, text) {
    document.getElementById(id).textContent = text;
}

function joinNames(players) {
    return players.map(player => player.name).join(", ");
}

function verdictKey(outcome) {
    if (outcome.free_impostors.length) return "free";
    return outcome.impostor_caught ? "caught" : "escaped";
}

function renderOutcome(outcome) {
    const verdict = VERDICTS[verdictKey(outcome)];
    const hasFree = outcome.free_impostors.length > 0;
    const card = document.getElementById("verdict-card");
    card.classList.toggle("card-players-win", outcome.impostor_caught);
    card.classList.toggle("card-impostor-win", !outcome.impostor_caught);
    setText("result-round", `RONDA ${outcome.current_round} DE ${outcome.total_rounds}`);
    setText("result-icon", verdict.icon);
    setText("result-kicker", verdict.kicker);
    setText("verdict-title", verdict.title);
    setText("result-voted", outcome.most_voted ? `${outcome.most_voted.name} (${outcome.top_votes} votos)` : "Empate / Sin mayoría");
    setText("result-impostors-label", hasFree ? "IMPOSTOR DESCUBIERTO:" : "IDENTIDAD DEL IMPOSTOR REAL:");
    setText("result-impostors", hasFree ? outcome.most_voted.name : joinNames(outcome.impostors));
    setText("result-free", joinNames(outcome.free_impostors));
    setText("result-word", outcome.secret_word);
    document.getElementById("result-free-box").classList.toggle("view-hidden", !hasFree);
    renderActions(outcome);
    card.classList.remove("view-hidden");
}

function renderActions(outcome) {
    document.getElementById("btn-next-round").classList.toggle("view-hidden", !outcome.has_next_round);
    document.getElementById("btn-play-again").classList.toggle("view-hidden", outcome.has_next_round);
    setText("btn-next-round-text", `INICIAR RONDA ${outcome.next_round} DE ${outcome.total_rounds}`);
    setText("btn-exit-text", outcome.has_next_round ? "TERMINAR PARTIDA Y SALIR" : "VOLVER AL INICIO");
}

function showError(message) {
    const box = document.getElementById("result-error");
    box.textContent = message;
    box.classList.remove("view-hidden");
}

async function handleNextRound(event) {
    const button = event.currentTarget;
    const state = ModoLocal.loadState();
    if (!state.outcome || !state.outcome.has_next_round) return;
    button.disabled = true;
    try {
        const words = await ModoLocal.loadWords(document.body.dataset.wordsUrl);
        ModoLocal.advanceToNextRound(state, words);
    } catch (error) {
        showError("No se pudieron cargar las palabras. Revisa tu conexión e inténtalo de nuevo.");
        button.disabled = false;
        return;
    }
    state.phase = "roles";
    if (!ModoLocal.saveState(state)) {
        showError("No se pudo guardar la partida en este dispositivo.");
        button.disabled = false;
        return;
    }
    window.location.assign(page.root.dataset.nextUrl);
}
