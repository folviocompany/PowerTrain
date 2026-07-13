(function () {
  window.addEventListener("DOMContentLoaded", () => {
    window.PowerTreino.UI.init();
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("service-worker.js").catch((error) => {
        console.warn("Service worker não registrado", error);
      });
    }
  });
})();
