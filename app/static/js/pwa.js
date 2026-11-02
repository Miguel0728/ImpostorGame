if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register(document.body.dataset.serviceWorkerUrl, { scope: "/" }).catch(() => null);
    });
}
