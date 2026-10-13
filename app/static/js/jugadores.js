document.addEventListener("DOMContentLoaded", initPlayersPage);

function initPlayersPage() {
    getPlayerInputs().forEach(input => input.addEventListener("focus", () => input.select()));
    document.getElementById("players-form").addEventListener("submit", handlePlayersSubmit);
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

function findPlayersError(inputs) {
    const empty = findFirstEmptyInput(inputs);
    if (empty) return { input: empty, message: "Todos los jugadores necesitan un nombre." };
    const duplicate = findFirstDuplicateInput(inputs);
    if (duplicate) return { input: duplicate, message: "Hay nombres repetidos. Cada jugador necesita un nombre distinto." };
    return null;
}

function handlePlayersSubmit(event) {
    const error = findPlayersError(getPlayerInputs());
    if (!error) return;
    event.preventDefault();
    showPlayersError(error.message);
    highlightInvalidInput(error.input);
}

function showPlayersError(message) {
    const box = document.getElementById("players-error");
    box.textContent = message;
    box.classList.remove("view-hidden");
}

function highlightInvalidInput(input) {
    input.focus();
    input.classList.add("input-error");
    setTimeout(() => input.classList.remove("input-error"), 1500);
}
