document.addEventListener("DOMContentLoaded", initVotingPage);

async function initVotingPage() {
    const form = document.getElementById("voting-form");
    const state = ModoLocal.loadState();
    if (!ModoLocal.hasGameInProgress(state)) {
        window.location.replace(form.dataset.configUrl);
        return;
    }
    if (!state.roles) {
        const words = await ModoLocal.loadWords(document.body.dataset.wordsUrl);
        ModoLocal.getStoredRoles(state, words);
    }
    state.phase = "voting";
    ModoLocal.saveState(state);
    document.getElementById("voters-list").replaceChildren(...state.roles.map(voter => makeVoterSlot(voter, state.roles)));
    form.addEventListener("submit", handleVoteSubmit);
}

function makeElement(tag, className, text = "") {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
}

function makeVoteSelect(voter, candidates) {
    const select = makeElement("select", "voting-select");
    Object.assign(select, { id: `vote-select-${voter.id}`, name: "voted_target", required: true });
    const placeholder = new Option("Elegir sospechoso...", "", true, true);
    placeholder.disabled = true;
    select.append(placeholder);
    candidates.filter(candidate => candidate.name !== voter.name).forEach(candidate => {
        select.append(new Option(candidate.name, candidate.name));
    });
    return select;
}

function makeVoterSlot(voter, candidates) {
    const slot = makeElement("div", `voter-slot color-theme-${voter.color_index}`);
    slot.setAttribute("role", "listitem");

    const avatar = makeElement("div", "voter-avatar");
    avatar.setAttribute("aria-hidden", "true");
    avatar.append(makeElement("span", "", String(voter.id)));
    const identity = makeElement("div", "voter-identity");
    identity.append(avatar, makeElement("span", "voter-name", voter.name));

    const label = makeElement("label", "choice-label", "Acusa a:");
    label.htmlFor = `vote-select-${voter.id}`;
    const choice = makeElement("div", "voter-choice");
    choice.append(label, makeVoteSelect(voter, candidates));

    slot.append(identity, choice);
    return slot;
}

function handleVoteSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const state = ModoLocal.loadState();
    const votes = Array.from(form.querySelectorAll("select[name='voted_target']")).map(select => select.value);
    state.outcome = ModoLocal.resolveVotingOutcome(state, votes);
    state.phase = "result";
    ModoLocal.saveState(state);
    window.location.assign(form.dataset.nextUrl);
}
