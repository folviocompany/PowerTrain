(function () {
  window.addEventListener("DOMContentLoaded", () => {
    window.PowerTreino.UI.init();
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
      navigator.serviceWorker.register("service-worker.js?v=20260719-2").then((registration) => {
        registration.update();
      }).catch((error) => {
        console.warn("Service worker nao registrado", error);
      });
    }
  });
})();
