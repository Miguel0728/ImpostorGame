document.addEventListener("DOMContentLoaded", initHomePage);

function initHomePage() {
    const state = ModoLocal.loadState();
    if (!ModoLocal.hasGameInProgress(state)) return;
    const button = document.getElementById("btn-continue");
    const urls = { roles: "rolesUrl", debate: "debateUrl", voting: "votingUrl", result: "resultUrl" };
    const target = button.dataset[urls[state.phase]];
    if (!target) return;
    button.href = target;
    button.classList.remove("view-hidden");
}
