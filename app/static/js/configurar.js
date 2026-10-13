const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const MIN_CUSTOM_WORDS = 3;

document.addEventListener("DOMContentLoaded", initConfigurationPage);

function initConfigurationPage() {
    bindStepper("players", updatePlayers);
    bindStepper("impostors", updateImpostors);
    setupCustomDropdown();
    syncImpostorsLimit();
    toggleCustomWordsVisibility();
    document.getElementById("config-form").addEventListener("submit", handleConfigSubmit);
}

function bindStepper(name, handler) {
    document.getElementById(`btn-sub-${name}`).addEventListener("click", () => handler(-1));
    document.getElementById(`btn-add-${name}`).addEventListener("click", () => handler(1));
}

function stepInput(input, delta, min, max) {
    input.value = Math.min(max, Math.max(min, parseInt(input.value, 10) + delta));
}

function getPlayersCount() {
    return parseInt(document.getElementById("players-input").value, 10);
}

function getMaxImpostors(players) {
    return 1 + (players >= 6) + (players >= 9);
}

function updatePlayers(delta) {
    stepInput(document.getElementById("players-input"), delta, MIN_PLAYERS, MAX_PLAYERS);
    syncImpostorsLimit();
}

function updateImpostors(delta) {
    stepInput(document.getElementById("impostors-input"), delta, 1, getMaxImpostors(getPlayersCount()));
}

function syncImpostorsLimit() {
    const players = getPlayersCount();
    const maxAllowed = getMaxImpostors(players);
    stepInput(document.getElementById("impostors-input"), 0, 1, maxAllowed);
    document.getElementById("impostors-hint").textContent = `Máximo ${maxAllowed} para ${players} tripulantes`;
}

function getDropdownItems() {
    return Array.from(document.querySelectorAll(".dropdown-item"));
}

function setupCustomDropdown() {
    const trigger = document.getElementById("dropdown-trigger");
    trigger.addEventListener("click", toggleDropdown);
    trigger.addEventListener("keydown", handleTriggerKeydown);
    document.getElementById("dropdown-menu").addEventListener("keydown", handleMenuKeydown);
    document.addEventListener("click", handleOutsideClick);
    getDropdownItems().forEach(item => {
        item.tabIndex = -1;
        item.addEventListener("click", () => selectCategoryOption(item));
    });
}

function setDropdownOpen(isOpen) {
    document.getElementById("dropdown-menu").classList.toggle("is-open", isOpen);
    document.getElementById("dropdown-trigger").setAttribute("aria-expanded", String(isOpen));
}

function toggleDropdown(event) {
    event.stopPropagation();
    setDropdownOpen(!document.getElementById("dropdown-menu").classList.contains("is-open"));
}

function closeDropdown() {
    setDropdownOpen(false);
}

function closeDropdownAndFocusTrigger() {
    closeDropdown();
    document.getElementById("dropdown-trigger").focus();
}

function handleOutsideClick(event) {
    if (!document.getElementById("category-dropdown").contains(event.target)) {
        closeDropdown();
    }
}

function handleTriggerKeydown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setDropdownOpen(true);
        (document.querySelector(".dropdown-item.is-selected") || getDropdownItems()[0]).focus();
    } else if (event.key === "Escape") {
        closeDropdown();
    }
}

function handleMenuKeydown(event) {
    const items = getDropdownItems();
    const index = items.indexOf(document.activeElement);
    const target = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[event.key];
    if (target !== undefined) {
        event.preventDefault();
        items[(target + items.length) % items.length].focus();
    } else {
        handleMenuActionKey(event, items[index]);
    }
}

function handleMenuActionKey(event, item) {
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectCategoryOption(item);
        closeDropdownAndFocusTrigger();
    } else if (event.key === "Escape") {
        closeDropdownAndFocusTrigger();
    } else if (event.key === "Tab") {
        closeDropdown();
    }
}

function selectCategoryOption(item) {
    document.getElementById("category-input").value = item.dataset.value;
    document.getElementById("dropdown-selected-text").textContent = item.querySelector(".item-name").textContent;
    updateSelectedDropdownItem(item);
    toggleCustomWordsVisibility();
    closeDropdown();
}

function updateSelectedDropdownItem(selectedItem) {
    getDropdownItems().forEach(item => {
        const isSelected = item === selectedItem;
        item.classList.toggle("is-selected", isSelected);
        item.setAttribute("aria-selected", String(isSelected));
    });
}

function toggleCustomWordsVisibility() {
    const isCustom = document.getElementById("category-input").value === "personalizada";
    document.getElementById("custom-words-container").classList.toggle("custom-words-hidden", !isCustom);
}

function countCustomWords(text) {
    const words = text.split(",").map(w => w.trim().replace(/\s+/g, " ").toLocaleLowerCase());
    return new Set(words.filter(Boolean)).size;
}

function handleConfigSubmit(event) {
    const textarea = document.getElementById("custom-words-input");
    const isCustom = document.getElementById("category-input").value === "personalizada";
    if (isCustom && countCustomWords(textarea.value) < MIN_CUSTOM_WORDS) {
        event.preventDefault();
        showCustomWordsError(textarea);
    }
}

function showCustomWordsError(textarea) {
    const box = document.getElementById("config-error");
    box.textContent = `Escribe al menos ${MIN_CUSTOM_WORDS} palabras distintas separadas por comas.`;
    box.classList.remove("view-hidden");
    textarea.classList.add("input-error");
    textarea.focus();
}
