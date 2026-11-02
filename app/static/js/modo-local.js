/*
 * Modo local (Pass & Play) sin servidor.
 * Replica las reglas de app/services/game_service.py; el estado de la partida vive en localStorage.
 * Se carga en el navegador (window.ModoLocal) y también desde Node para las pruebas (tests/).
 */
(function (root) {
    "use strict";

    const MIN_PLAYERS = 3;
    const MAX_PLAYERS = 12;
    const MAX_NAME_LENGTH = 16;
    const MIN_CUSTOM_WORDS = 3;
    const ALLOWED_ROUNDS = [1, 2, 3, 5];
    const ALLOWED_TIMES = [0, 60, 90, 120];
    const COLOR_COUNT = 6;
    const ROUND_STATE_KEYS = ["roles", "secret_word", "outcome", "reveal_index", "debate"];
    const GAME_KEY = "sospecha.partida";
    const WORDS_KEY = "sospecha.palabras.v2";

    const DEFAULT_SETTINGS = {
        players: 4,
        impostors: 1,
        rounds: 3,
        time_seconds: 120,
        category: "lugares",
        custom_words: ""
    };

    let storage = null;
    try {
        storage = root.localStorage || null;
    } catch (error) {
        storage = null;
    }

    function casefold(text) {
        return text.toLowerCase().replace(/ß/g, "ss");
    }

    function collapseSpaces(text) {
        return text.split(/\s+/).filter(Boolean).join(" ");
    }

    function clamp(value, low, high) {
        return Math.max(low, Math.min(high, value));
    }

    function nearest(value, allowed) {
        return allowed.reduce((best, option) => (Math.abs(option - value) < Math.abs(best - value) ? option : best));
    }

    function colorIndexFor(index) {
        return (index % COLOR_COUNT) + 1;
    }

    function maxImpostorsFor(players) {
        return 1 + (players >= 6) + (players >= 9);
    }

    function formInt(value, fallback) {
        const text = String(value).trim();
        return /^[+-]?\d+$/.test(text) ? parseInt(text, 10) : fallback;
    }

    function randomInt(limit) {
        if (root.crypto && root.crypto.getRandomValues) {
            const buffer = new Uint32Array(1);
            const ceiling = Math.floor(0x100000000 / limit) * limit;
            do {
                root.crypto.getRandomValues(buffer);
            } while (buffer[0] >= ceiling);
            return buffer[0] % limit;
        }
        return Math.floor(Math.random() * limit);
    }

    function randomChoice(list) {
        return list[randomInt(list.length)];
    }

    function randomSample(count, size) {
        const pool = Array.from({ length: count }, (_, index) => index);
        for (let i = pool.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        return pool.slice(0, size);
    }

    function parseCustomWords(rawText) {
        const unique = new Map();
        String(rawText).split(",").forEach(word => {
            const clean = collapseSpaces(word);
            if (clean && !unique.has(casefold(clean))) unique.set(casefold(clean), clean);
        });
        return Array.from(unique.values());
    }

    // categoryIds: las categorías disponibles (las mismas que muestra el menú, que salen de words.json).
    function buildConfiguration(form, categoryIds) {
        const players = clamp(formInt(form.players, DEFAULT_SETTINGS.players), MIN_PLAYERS, MAX_PLAYERS);
        const impostors = formInt(form.impostors, DEFAULT_SETTINGS.impostors);
        return {
            players,
            impostors: clamp(impostors, 1, maxImpostorsFor(players)),
            rounds: nearest(formInt(form.rounds, DEFAULT_SETTINGS.rounds), ALLOWED_ROUNDS),
            time_seconds: nearest(formInt(form.time_seconds, DEFAULT_SETTINGS.time_seconds), ALLOWED_TIMES),
            category: categoryIds.includes(form.category) ? form.category : DEFAULT_SETTINGS.category,
            custom_words: String(form.custom_words === undefined || form.custom_words === null ? "" : form.custom_words).trim()
        };
    }

    function validateConfiguration(config) {
        if (config.category === "personalizada" && parseCustomWords(config.custom_words).length < MIN_CUSTOM_WORDS) {
            return `Escribe al menos ${MIN_CUSTOM_WORDS} palabras distintas separadas por comas.`;
        }
        return null;
    }

    function namesError(names, expectedCount) {
        if (names.length !== expectedCount || !names.every(Boolean)) {
            return "Todos los jugadores necesitan un nombre.";
        }
        if (names.some(name => Array.from(name).length > MAX_NAME_LENGTH)) {
            return `Los nombres admiten hasta ${MAX_NAME_LENGTH} caracteres.`;
        }
        if (new Set(names.map(casefold)).size !== names.length) {
            return "Hay nombres repetidos. Cada jugador necesita un nombre distinto.";
        }
        return null;
    }

    function validatePlayerNames(namesList, expectedCount) {
        const names = namesList.map(collapseSpaces);
        return { names, error: namesError(names, expectedCount) };
    }

    function defaultPlayerNames(count) {
        return Array.from({ length: count }, (_, index) => `Jugador ${index + 1}`);
    }

    function generatePlayerSlots(playerCount, names) {
        const given = names || [];
        return Array.from({ length: playerCount }, (_, index) => ({
            id: index + 1,
            placeholder: index < given.length ? given[index] : `Jugador ${index + 1}`,
            color_index: colorIndexFor(index)
        }));
    }

    function getGameConfiguration(state) {
        return state.config || Object.assign({}, DEFAULT_SETTINGS);
    }

    function getPlayerNames(state) {
        return state.players || defaultPlayerNames(getGameConfiguration(state).players);
    }

    function wordsOf(wordData, categoryId) {
        const category = wordData.categories.find(item => item.id === categoryId);
        return category && category.words && category.words.length ? category.words : null;
    }

    function pickSecretWord(categoryId, customWords, wordData) {
        const custom = categoryId === "personalizada" ? parseCustomWords(customWords) : [];
        const pool = custom.length ? custom : (wordsOf(wordData, categoryId) || wordsOf(wordData, DEFAULT_SETTINGS.category));
        return randomChoice(pool);
    }

    function buildPlayerRolePayload(index, name, isImpostor, secretWord) {
        return {
            id: index + 1,
            name,
            color_index: colorIndexFor(index),
            is_impostor: isImpostor,
            role_title: isImpostor ? "IMPOSTOR" : "JUGADOR",
            word: isImpostor ? "???" : secretWord,
            hint: isImpostor ? "Finge conocer la palabra secreta" : "Descubre quién finge conocer la palabra"
        };
    }

    function clearRoundState(state) {
        ROUND_STATE_KEYS.forEach(key => delete state[key]);
    }

    function saveConfiguration(state, config) {
        clearRoundState(state);
        delete state.players;
        state.config = config;
        state.current_round = 1;
    }

    function initializeNewGame(state, words) {
        const config = getGameConfiguration(state);
        const names = getPlayerNames(state);
        const word = pickSecretWord(config.category, config.custom_words || "", words);
        const impostorIndices = new Set(randomSample(names.length, Math.min(config.impostors, names.length - 1)));
        state.roles = names.map((name, index) => buildPlayerRolePayload(index, name, impostorIndices.has(index), word));
        state.secret_word = word;
        return state.roles;
    }

    function getStoredRoles(state, words) {
        if (state.roles && state.secret_word !== undefined) return state.roles;
        return initializeNewGame(state, words);
    }

    function tallyVotes(rawVotes) {
        const counts = new Map();
        rawVotes.filter(Boolean).forEach(vote => counts.set(vote, (counts.get(vote) || 0) + 1));
        return counts;
    }

    function findMostVotedRole(roles, voteCounts) {
        if (!voteCounts.size) return { mostVoted: null, topVotes: 0 };
        const topVotes = Math.max(...voteCounts.values());
        const leaders = Array.from(voteCounts).filter(([, total]) => total === topVotes).map(([name]) => name);
        if (leaders.length > 1) return { mostVoted: null, topVotes };
        return { mostVoted: roles.find(role => role.name === leaders[0]) || null, topVotes };
    }

    function summarizeImpostors(roles, mostVoted) {
        const impostors = roles.filter(role => role.is_impostor);
        const caught = Boolean(mostVoted && mostVoted.is_impostor);
        return {
            impostor_caught: caught,
            impostors,
            free_impostors: caught ? impostors.filter(impostor => impostor.id !== mostVoted.id) : []
        };
    }

    function getRoundInfo(state) {
        const current = state.current_round || 1;
        const total = getGameConfiguration(state).rounds;
        return { current_round: current, total_rounds: total, has_next_round: current < total, next_round: current + 1 };
    }

    function resolveVotingOutcome(state, rawVotes, words) {
        const roles = getStoredRoles(state, words);
        const { mostVoted, topVotes } = findMostVotedRole(roles, tallyVotes(rawVotes));
        return Object.assign({
            most_voted: mostVoted,
            top_votes: topVotes,
            secret_word: state.secret_word !== undefined ? state.secret_word : "Desconocida"
        }, summarizeImpostors(roles, mostVoted), getRoundInfo(state));
    }

    function advanceToNextRound(state, words) {
        const current = state.current_round || 1;
        clearRoundState(state);
        state.current_round = current + 1;
        return initializeNewGame(state, words);
    }

    function getGameplayData(state) {
        const names = getPlayerNames(state);
        return Object.assign({
            players: names.map((name, index) => ({ id: index + 1, name, color_index: colorIndexFor(index) })),
            time_seconds: getGameConfiguration(state).time_seconds
        }, getRoundInfo(state));
    }

    function readJson(key) {
        try {
            const raw = storage && storage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function writeJson(key, value) {
        try {
            storage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            return false;
        }
    }

    function loadState() {
        return readJson(GAME_KEY) || {};
    }

    function saveState(state) {
        return writeJson(GAME_KEY, state);
    }

    function clearGame() {
        try {
            storage.removeItem(GAME_KEY);
        } catch (error) {
            // Sin almacenamiento no hay partida que borrar.
        }
    }

    function hasGameInProgress(state) {
        return Boolean(state.phase && state.config && state.players);
    }

    async function loadWords(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const words = await response.json();
            writeJson(WORDS_KEY, words);
            return words;
        } catch (error) {
            const cached = readJson(WORDS_KEY);
            if (cached) return cached;
            throw error;
        }
    }

    const ModoLocal = {
        MIN_PLAYERS, MAX_PLAYERS, MAX_NAME_LENGTH, MIN_CUSTOM_WORDS, ALLOWED_ROUNDS, ALLOWED_TIMES, DEFAULT_SETTINGS,
        colorIndexFor, maxImpostorsFor, parseCustomWords, buildConfiguration, validateConfiguration,
        validatePlayerNames, defaultPlayerNames, generatePlayerSlots, getGameConfiguration, getPlayerNames,
        pickSecretWord, buildPlayerRolePayload, clearRoundState, saveConfiguration, initializeNewGame,
        getStoredRoles, tallyVotes, findMostVotedRole, summarizeImpostors, getRoundInfo, resolveVotingOutcome,
        advanceToNextRound, getGameplayData, loadState, saveState, clearGame, hasGameInProgress, loadWords
    };

    if (typeof module !== "undefined" && module.exports) module.exports = ModoLocal;
    root.ModoLocal = ModoLocal;
})(typeof window !== "undefined" ? window : globalThis);
