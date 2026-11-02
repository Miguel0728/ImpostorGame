// Ejecutar con: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const ModoLocal = require("../app/static/js/modo-local.js");
const words = require("../app/database/words.json");

const ALL_WORDS = words;
const CATEGORY_IDS = words.categories.map(category => category.id);

function wordsIn(categoryId) {
    return words.categories.find(category => category.id === categoryId).words;
}

function configFor(overrides = {}) {
    return ModoLocal.buildConfiguration(Object.assign({}, ModoLocal.DEFAULT_SETTINGS, overrides), CATEGORY_IDS);
}

test("words.json: categorías únicas y todas traen palabras salvo las propias", () => {
    assert.equal(new Set(CATEGORY_IDS).size, CATEGORY_IDS.length);
    assert.ok(CATEGORY_IDS.includes("personalizada"));
    for (const category of words.categories) {
        assert.ok(category.name);
        if (category.id !== "personalizada") assert.ok(category.words.length >= 3, category.id);
    }
});

function startedState(overrides = {}, names) {
    const state = {};
    ModoLocal.saveConfiguration(state, configFor(overrides));
    state.players = names || ModoLocal.defaultPlayerNames(state.config.players);
    ModoLocal.initializeNewGame(state, ALL_WORDS);
    return state;
}

function fixedRoles(impostorNames, names) {
    return names.map((name, index) => ModoLocal.buildPlayerRolePayload(index, name, impostorNames.includes(name), "Faro"));
}

function outcomeFor(roles, votes, rounds = 3, currentRound = 1) {
    const state = { config: configFor({ rounds }), roles, secret_word: "Faro", current_round: currentRound };
    return ModoLocal.resolveVotingOutcome(state, votes);
}

test("jugadores: de 3 a 12", () => {
    assert.equal(configFor({ players: 2 }).players, 3);
    assert.equal(configFor({ players: 13 }).players, 12);
    assert.equal(configFor({ players: "abc" }).players, 4);
});

test("impostores: 1 hasta 5 jugadores, 2 desde 6 y 3 desde 9", () => {
    const expected = { 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 3, 12: 3 };
    for (const [players, max] of Object.entries(expected)) {
        assert.equal(ModoLocal.maxImpostorsFor(Number(players)), max);
        assert.equal(configFor({ players, impostors: 99 }).impostors, max);
    }
    assert.equal(configFor({ players: 12, impostors: 0 }).impostors, 1);
});

test("rondas: 1, 2, 3 o 5 (la más cercana, en empate la menor)", () => {
    assert.equal(configFor({ rounds: 4 }).rounds, 3);
    assert.equal(configFor({ rounds: 0 }).rounds, 1);
    assert.equal(configFor({ rounds: 9 }).rounds, 5);
});

test("tiempo de debate: 0, 60, 90 o 120", () => {
    assert.equal(configFor({ time_seconds: 75 }).time_seconds, 60);
    assert.equal(configFor({ time_seconds: 200 }).time_seconds, 120);
    assert.equal(configFor({ time_seconds: 0 }).time_seconds, 0);
    assert.equal(configFor({ time_seconds: -30 }).time_seconds, 0);
});

test("categoría inválida vuelve a lugares", () => {
    assert.equal(configFor({ category: "espacio" }).category, "lugares");
    assert.equal(configFor({ category: "personalizada" }).category, "personalizada");
});

test("nombres: no vacíos, máximo 16 caracteres, sin repetir sin distinguir mayúsculas", () => {
    const check = (names) => ModoLocal.validatePlayerNames(names, names.length).error;
    assert.equal(check(["Ana", "Luis", "Eva"]), null);
    assert.match(check(["Ana", "  ", "Eva"]), /necesitan un nombre/);
    assert.match(check(["Ana", "A".repeat(17), "Eva"]), /hasta 16 caracteres/);
    assert.equal(check(["Ana", "A".repeat(16), "Eva"]), null);
    assert.match(check(["Ana", "ana", "Eva"]), /repetidos/);
    assert.match(check(["Ana", "ANA  ", "Eva"]), /repetidos/);
    assert.match(ModoLocal.validatePlayerNames(["Ana", "Luis"], 3).error, /necesitan un nombre/);
    assert.deepEqual(ModoLocal.validatePlayerNames(["  Ana   María "], 1).names, ["Ana María"]);
});

test("palabras propias: mínimo 3 distintas, sin repetidas sin distinguir mayúsculas", () => {
    assert.deepEqual(ModoLocal.parseCustomWords("Sol, sol ,  Luna,,  Mar  Azul "), ["Sol", "Luna", "Mar Azul"]);
    const invalid = (text) => ModoLocal.validateConfiguration(configFor({ category: "personalizada", custom_words: text }));
    assert.match(invalid("uno, dos"), /al menos 3 palabras distintas/);
    assert.match(invalid("uno, UNO, dos"), /al menos 3 palabras distintas/);
    assert.equal(invalid("uno, dos, tres"), null);
    assert.equal(ModoLocal.validateConfiguration(configFor({ category: "lugares" })), null);
});

test("reparto: impostores sin palabra y jugadores con la palabra de la categoría", () => {
    const state = startedState({ players: 6, impostors: 2, category: "comida" });
    const impostors = state.roles.filter(role => role.is_impostor);
    assert.equal(state.roles.length, 6);
    assert.equal(impostors.length, 2);
    assert.ok(wordsIn("comida").includes(state.secret_word));
    assert.ok(impostors.every(role => role.word === "???" && role.role_title === "IMPOSTOR"));
    assert.ok(state.roles.filter(role => !role.is_impostor).every(role => role.word === state.secret_word && role.role_title === "JUGADOR"));
});

test("reparto: palabra de las palabras propias", () => {
    const state = startedState({ category: "personalizada", custom_words: "uno, dos, tres" });
    assert.ok(["uno", "dos", "tres"].includes(state.secret_word));
});

test("votación: gana quien tiene más votos", () => {
    const roles = fixedRoles(["Ana"], ["Ana", "Luis", "Eva", "Sol"]);
    const outcome = outcomeFor(roles, ["Ana", "Ana", "Luis", "Ana"]);
    assert.equal(outcome.most_voted.name, "Ana");
    assert.equal(outcome.top_votes, 3);
    assert.equal(outcome.impostor_caught, true);
    assert.deepEqual(outcome.free_impostors, []);
});

test("votación: empate en el primer lugar no hay mayoría y el impostor escapa", () => {
    const roles = fixedRoles(["Ana"], ["Ana", "Luis", "Eva", "Sol"]);
    const outcome = outcomeFor(roles, ["Ana", "Ana", "Luis", "Luis"]);
    assert.equal(outcome.most_voted, null);
    assert.equal(outcome.top_votes, 2);
    assert.equal(outcome.impostor_caught, false);
});

test("votación: si se expulsa a un impostor pero quedan otros libres, solo pierde el expulsado", () => {
    const roles = fixedRoles(["Ana", "Luis"], ["Ana", "Luis", "Eva", "Sol", "Mar", "Rio"]);
    const outcome = outcomeFor(roles, ["Ana", "Ana", "Ana", "Eva", "Luis", "Ana"]);
    assert.equal(outcome.impostor_caught, true);
    assert.deepEqual(outcome.free_impostors.map(role => role.name), ["Luis"]);
    assert.equal(outcome.impostors.length, 2);
});

test("votación: se señala a un jugador inocente y el impostor escapa", () => {
    const roles = fixedRoles(["Ana"], ["Ana", "Luis", "Eva"]);
    const outcome = outcomeFor(roles, ["Luis", "Luis", "Eva"]);
    assert.equal(outcome.most_voted.name, "Luis");
    assert.equal(outcome.impostor_caught, false);
    assert.deepEqual(outcome.free_impostors, []);
});

test("votación: sin votos no hay mayoría", () => {
    const roles = fixedRoles(["Ana"], ["Ana", "Luis", "Eva"]);
    const outcome = outcomeFor(roles, []);
    assert.equal(outcome.most_voted, null);
    assert.equal(outcome.top_votes, 0);
});

test("rondas: nueva palabra y roles, y tras la última no hay siguiente", () => {
    const state = startedState({ rounds: 2 });
    state.outcome = { has_next_round: true };
    assert.equal(ModoLocal.getRoundInfo(state).has_next_round, true);
    ModoLocal.advanceToNextRound(state, ALL_WORDS);
    assert.equal(state.current_round, 2);
    assert.equal(state.outcome, undefined);
    assert.ok(state.roles.length > 0);
    const info = ModoLocal.getRoundInfo(state);
    assert.deepEqual([info.current_round, info.total_rounds, info.has_next_round, info.next_round], [2, 2, false, 3]);
});

test("configuración nueva reinicia la partida en la ronda 1", () => {
    const state = startedState({ rounds: 3 });
    state.current_round = 3;
    ModoLocal.saveConfiguration(state, configFor({ players: 5 }));
    assert.equal(state.current_round, 1);
    assert.equal(state.roles, undefined);
    assert.equal(state.players, undefined);
});

test("casillas de nombres: nombres por defecto y colores de la paleta", () => {
    const slots = ModoLocal.generatePlayerSlots(7);
    assert.equal(slots[0].placeholder, "Jugador 1");
    assert.deepEqual(slots.map(slot => slot.color_index), [1, 2, 3, 4, 5, 6, 1]);
    assert.equal(ModoLocal.generatePlayerSlots(3, ["Ana"])[0].placeholder, "Ana");
});

test("sin almacenamiento la carga no falla", () => {
    assert.deepEqual(ModoLocal.loadState(), {});
    assert.equal(ModoLocal.saveState({ a: 1 }), false);
});
