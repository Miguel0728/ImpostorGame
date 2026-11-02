document.addEventListener("DOMContentLoaded", initPlayersPage);

function initPlayersPage() {
    const form = document.getElementById("players-form");
    const state = ModoLocal.loadState();
    if (!state.config) {
        window.location.replace(form.dataset.configUrl);
        return;
    }
    const count = state.config.players;
    const savedNames = state.players && state.players.length === count ? state.players : [];
    document.getElementById("players-count").textContent = String(count);
    document.getElementById("players-list").replaceChildren(...ModoLocal.generatePlayerSlots(count, savedNames).map(makePlayerSlot));
    getPlayerInputs().forEach(input => input.addEventListener("focus", () => input.select()));
    form.addEventListener("submit", handlePlayersSubmit);
}

function makeElement(tag, className, text = "") {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
}

function makePlayerSlot(slot) {
    const row = makeElement("div", `player-slot color-theme-${slot.color_index}`);
    row.setAttribute("role", "listitem");

    const avatar = makeElement("div", "player-avatar");
    avatar.setAttribute("aria-hidden", "true");
    avatar.append(makeElement("span", "player-number", String(slot.id)));

    const label = makeElement("label", "player-label", `Jugador ${slot.id}`);
    label.htmlFor = `player-input-${slot.id}`;
    const input = makeElement("input", "player-input");
    Object.assign(input, {
        type: "text", id: `player-input-${slot.id}`, name: "player_name", value: slot.placeholder,
        placeholder: "Nombre o apodo", maxLength: 16, autocomplete: "off", required: true
    });

    const field = makeElement("div", "player-field");
    field.append(label, input);
    row.append(avatar, field);
    return row;
}

function getPlayerInputs() {
    return Array.from(document.querySelectorAll(".player-input"));
}

function normalizeName(value) {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function findFirstEmptyInput(inputs) {
    return inputs.find(input => normalizeName(input.value) === "");
}

function findFirstDuplicateInput(inputs) {
    const seen = new Set();
    return inputs.find(input => {
        const key = normalizeName(input.value);
        const isDuplicate = seen.has(key);
        seen.add(key);
        return isDuplicate;
    });
}

async function handlePlayersSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const inputs = getPlayerInputs();
    const state = ModoLocal.loadState();
    const { names, error } = ModoLocal.validatePlayerNames(inputs.map(input => input.value), state.config.players);
    if (error) {
        showPlayersError(error);
        highlightInvalidInput(findFirstEmptyInput(inputs) || findFirstDuplicateInput(inputs));
        return;
    }
    await startGame(form, state, names);
}

async function startGame(form, state, names) {
    try {
        const words = await ModoLocal.loadWords(document.body.dataset.wordsUrl);
        state.players = names;
        ModoLocal.initializeNewGame(state, words);
    } catch (error) {
        showPlayersError("No se pudieron cargar las palabras. Revisa tu conexión e inténtalo de nuevo.");
        return;
    }
    state.phase = "roles";
    if (!ModoLocal.saveState(state)) {
        showPlayersError("No se pudo guardar la partida en este dispositivo.");
        return;
    }
    window.location.assign(form.dataset.nextUrl);
}

function showPlayersError(message) {
    const box = document.getElementById("players-error");
    box.textContent = message;
    box.classList.remove("view-hidden");
}

function highlightInvalidInput(input) {
    if (!input) return;
    input.focus();
    input.classList.add("input-error");
    setTimeout(() => input.classList.remove("input-error"), 1500);
}
