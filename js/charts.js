(function () {
  const charts = {};
  const C = window.PowerTreino.Calculations;

  function canChart() {
    return typeof Chart !== "undefined";
  }

  function destroy(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  function line(id, labels, datasets) {
    destroy(id);
    const canvas = document.getElementById(id);
    if (!canvas || !canChart()) {
      if (canvas) canvas.outerHTML = '<p class="muted">Gráfico indisponível offline até o Chart.js ser armazenado localmente.</p>';
      return;
    }
    charts[id] = new Chart(canvas, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#f3f5f7" } } },
        scales: {
          x: { ticks: { color: "#a7afbd" }, grid: { color: "#2c313a" } },
          y: { ticks: { color: "#a7afbd" }, grid: { color: "#2c313a" } },
        },
      },
    });
  }

  function recentSessions(data, weeks) {
    if (!weeks || weeks === "all") return data.sessions;
    const since = new Date();
    since.setDate(since.getDate() - Number(weeks) * 7);
    return data.sessions.filter((session) => new Date(session.date) >= since);
  }

  function renderDashboard(data) {
    const labels = [];
    const liftKeys = ["squat", "bench", "deadlift"];
    const liftLabels = { squat: "Agachamento", bench: "Supino", deadlift: "Terra" };
    liftKeys.forEach((key) => (data.lifts[key].history || []).forEach((item) => {
      if (!labels.includes(item.date)) labels.push(item.date);
    }));
    labels.sort();
    line("chart-e1rm", labels, liftKeys.map((key, index) => ({
      label: liftLabels[key],
      data: labels.map((date) => {
        const match = (data.lifts[key].history || []).find((item) => item.date === date);
        return match ? Math.round(C.estimate1RM(match.weight, match.reps, data.settings.formula)) : null;
      }),
      borderColor: ["#d6a821", "#55d68b", "#77a6ff"][index],
      tension: 0.25,
    })));
    line("chart-bodyweight", data.bodyweight.map((item) => item.date), [{
      label: "Peso corporal",
      data: data.bodyweight.map((item) => item.weight),
      borderColor: "#d6a821",
      tension: 0.25,
    }]);
  }

  function renderProgress(data, weeks) {
    const sessions = recentSessions(data, weeks);
    const labels = sessions.map((session) => session.date);
    line("chart-volume", labels, [{
      label: "Volume",
      data: sessions.map((session) => session.summary.volume),
      borderColor: "#d6a821",
      tension: 0.2,
    }]);
    line("chart-rpe", labels, [{
      label: "RPE médio",
      data: sessions.map((session) => session.summary.avgRpe),
      borderColor: "#ff8d6b",
      tension: 0.2,
    }]);
    line("chart-total", labels, [{
      label: "Total estimado",
      data: sessions.map(() => ["squat", "bench", "deadlift"].reduce((sum, key) => sum + data.lifts[key].e1rm, 0)),
      borderColor: "#77a6ff",
      tension: 0.2,
    }]);
  }

  window.PowerTreino = window.PowerTreino || {};
  window.PowerTreino.Charts = { renderDashboard, renderProgress, destroy };
})();
