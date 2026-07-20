(function () {
  const C = window.PowerTreino.Calculations;
  const S = window.PowerTreino.Storage;
  const P = window.PowerTreino.Program;
  const Charts = window.PowerTreino.Charts;

  let data;
  let route = "dashboard";
  let workoutDraft = null;
  let restTimer = null;
  let restLeft = 0;

  const routes = [
    ["dashboard", "Dashboard"],
    ["maximas", "Máximas"],
    ["treino", "Treino"],
    ["historico", "Histórico"],
    ["progressao", "Progressão"],
    ["competicao", "Competição"],
    ["configuracoes", "Configurações"],
  ];

  function init() {
    data = S.load();
    S.recomputeLifts(data);
    S.save(data);
    renderNav();
    render();
  }

  function h(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    }[char]));
  }

  function app() {
    return document.getElementById("app");
  }

  function toast(message) {
    const node = document.getElementById("toast");
    node.textContent = message;
    node.classList.add("show");
    setTimeout(() => node.classList.remove("show"), 2600);
  }

  function renderNav() {
    document.getElementById("main-nav").innerHTML = routes.map(([key, label]) => (
      `<button type="button" data-route="${key}" class="${route === key ? "active" : ""}">${label}</button>`
    )).join("");
    document.querySelectorAll("[data-route]").forEach((button) => {
      button.addEventListener("click", () => {
        route = button.dataset.route;
        renderNav();
        render();
      });
    });
  }

  function head(title, subtitle, action = "") {
    return `<header class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div>${action}</header>`;
  }

  function currentBodyweight() {
    return data.bodyweight[data.bodyweight.length - 1] || { weight: data.profile.initialBodyweight };
  }

  function dashboard() {
    const bw = currentBodyweight();
    const volume = data.sessions.reduce((sum, item) => sum + (item.summary.volume || 0), 0);
    const next = P.getWorkout(data, P.nextWorkoutKey(), data.program.currentWeek);
    app().innerHTML = head("Dashboard", "Controle pessoal de treino raw com cálculos visíveis, histórico local e funcionamento offline.", `<div class="toolbar"><button class="ghost" id="edit-maxes">Ajustar máximas</button><button class="primary" id="start-workout">Iniciar treino</button></div>`) + `
      <section class="grid cols-4">
        ${metric("Peso atual", C.formatKg(bw.weight))}
        ${metric("Meta", `${data.profile.targetWeightMin}-${data.profile.targetWeightMax} kg`)}
        ${metric("Semana do bloco", `${data.program.currentWeek}/7${data.program.currentWeek >= 7 ? " deload" : ""}`)}
        ${metric("Treinos concluídos", data.sessions.length)}
      </section>
      <section class="grid cols-3">
        ${liftCard("squat")}
        ${liftCard("bench")}
        ${liftCard("deadlift")}
      </section>
      <section class="grid cols-2">
        <article class="card"><h2>Evolução do e1RM</h2><canvas id="chart-e1rm"></canvas></article>
        <article class="card"><h2>Peso corporal</h2><canvas id="chart-bodyweight"></canvas></article>
      </section>
      <section class="grid cols-2">
        <article class="card"><h2>Próximo treino</h2><p><strong>${next.label}</strong> • ${next.title}</p><p class="muted">${next.deload ? "Deload ativo: volume -40%, intensidade -10%, sem singles pesados." : "Singles são prática técnica, não teste de máximo."}</p></article>
        <article class="card"><h2>Resumo</h2><p>Volume total registrado: <strong>${Math.round(volume).toLocaleString("pt-BR")} kg</strong></p><p class="muted">Este aplicativo não substitui treinador, médico ou nutricionista.</p></article>
      </section>`;
    document.getElementById("start-workout").addEventListener("click", () => {
      route = "treino";
      renderNav();
      render();
    });
    document.getElementById("edit-maxes").addEventListener("click", () => {
      route = "maximas";
      renderNav();
      render();
    });
    Charts.renderDashboard(data);
  }

  function metric(label, value) {
    return `<article class="card metric"><small>${label}</small><strong>${value}</strong></article>`;
  }

  function liftCard(key) {
    const lift = data.lifts[key];
    const history = lift.history || [];
    const previous = history[history.length - 2];
    const variation = previous ? lift.e1rm - C.estimate1RM(previous.weight, previous.reps, data.settings.formula) : 0;
    return `<article class="card lift-card">
      <h2>${lift.name}</h2>
      <p>Melhor série: <strong>${C.formatKg(lift.bestWeight)} x ${lift.bestReps}</strong></p>
      <p>e1RM: <strong>${C.formatKg(lift.e1rm)}</strong></p>
      <p>Training Max (${data.settings.trainingMaxPercent}%): <strong>${C.formatKg(lift.trainingMax)}</strong></p>
      <p class="muted">Variação semanal: ${variation >= 0 ? "+" : ""}${C.formatKg(variation)}</p>
    </article>`;
  }

  function maximas() {
    app().innerHTML = head("Máximas", "Ajuste agachamento, supino e terra em um só lugar. Informe a melhor série recente; o app calcula e1RM, Training Max e cargas do treino.") + `
      <section class="notice">Use uma série confiável, sem falha e com técnica boa. O Training Max é calculado por ${data.settings.trainingMaxPercent}% do e1RM e arredondado para ${data.settings.increment} kg.</section>
      <section class="grid cols-3">
        ${maxCard("squat")}
        ${maxCard("bench")}
        ${maxCard("deadlift")}
      </section>
      <section class="card">
        <h2>Configuração rápida</h2>
        <div class="form-grid">
          <label>Fórmula de e1RM
            <select id="max-formula">
              <option value="epley" ${data.settings.formula === "epley" ? "selected" : ""}>Epley</option>
              <option value="brzycki" ${data.settings.formula === "brzycki" ? "selected" : ""}>Brzycki</option>
              <option value="lombardi" ${data.settings.formula === "lombardi" ? "selected" : ""}>Lombardi</option>
            </select>
          </label>
          <label>Training Max (%)
            <input id="max-tm-percent" type="number" min="80" max="100" value="${h(data.settings.trainingMaxPercent)}">
          </label>
          <label>Incremento de carga
            <select id="max-increment">${[1,1.25,2,2.5,5].map((v) => `<option value="${v}" ${Number(data.settings.increment) === v ? "selected" : ""}>${v} kg</option>`).join("")}</select>
          </label>
          <button class="primary" id="save-maxes">Salvar máximas</button>
          <button class="ghost" id="auto-maxes">Usar melhores do histórico</button>
        </div>
      </section>
      <section class="grid cols-3">
        ${["squat", "bench", "deadlift"].map((key) => trainingPreview(key)).join("")}
      </section>`;
    document.querySelectorAll("[data-max-field]").forEach((field) => field.addEventListener("input", updateMaxPreview));
    document.getElementById("max-formula").addEventListener("change", updateMaxPreview);
    document.getElementById("max-tm-percent").addEventListener("input", updateMaxPreview);
    document.getElementById("max-increment").addEventListener("change", updateMaxPreview);
    document.getElementById("save-maxes").addEventListener("click", saveMaxes);
    document.getElementById("auto-maxes").addEventListener("click", useHistoryMaxes);
    updateMaxPreview();
  }

  function maxCard(key) {
    const lift = data.lifts[key];
    return `<article class="card lift-card" data-max-card="${key}">
      <h2>${lift.name}</h2>
      <div class="form-grid">
        <label>Peso da série
          <input data-max-field="${key}.weight" type="number" step="0.5" min="0" value="${h(lift.bestWeight || lift.weight)}">
        </label>
        <label>Repetições
          <input data-max-field="${key}.reps" type="number" step="1" min="1" max="12" value="${h(lift.bestReps || lift.reps)}">
        </label>
        <label>Data
          <input data-max-field="${key}.date" type="date" value="${new Date().toISOString().slice(0, 10)}">
        </label>
      </div>
      <div class="grid cols-2" style="margin-top:12px">
        <div class="metric"><small>e1RM calculado</small><strong data-max-preview="${key}.e1rm"></strong></div>
        <div class="metric"><small>Training Max</small><strong data-max-preview="${key}.tm"></strong></div>
      </div>
      <p class="muted">${lift.manualMax ? "Modo manual ativo: esta máxima atual tem prioridade sobre o histórico." : "Modo automático: usando melhor série do histórico."}</p>
    </article>`;
  }

  function readMaxDraft() {
    const formula = document.getElementById("max-formula").value;
    const tmPercent = Number(document.getElementById("max-tm-percent").value) || 90;
    const increment = Number(document.getElementById("max-increment").value) || 2.5;
    const lifts = {};
    document.querySelectorAll("[data-max-field]").forEach((field) => {
      const [key, prop] = field.dataset.maxField.split(".");
      lifts[key] = lifts[key] || {};
      lifts[key][prop] = field.type === "number" ? Number(field.value) : field.value;
    });
    return { formula, tmPercent, increment, lifts };
  }

  function updateMaxPreview() {
    const draft = readMaxDraft();
    Object.entries(draft.lifts).forEach(([key, lift]) => {
      const e1rm = C.estimate1RM(lift.weight, lift.reps, draft.formula);
      const tm = C.trainingMax(e1rm, draft.tmPercent, draft.increment);
      const e1rmNode = document.querySelector(`[data-max-preview="${key}.e1rm"]`);
      const tmNode = document.querySelector(`[data-max-preview="${key}.tm"]`);
      if (e1rmNode) e1rmNode.textContent = C.formatKg(e1rm);
      if (tmNode) tmNode.textContent = C.formatKg(tm);
    });
  }

  function saveMaxes() {
    const draft = readMaxDraft();
    data.settings.formula = draft.formula;
    data.settings.trainingMaxPercent = Math.min(100, Math.max(80, draft.tmPercent));
    data.settings.increment = draft.increment;
    Object.entries(draft.lifts).forEach(([key, liftDraft]) => {
      const lift = data.lifts[key];
      if (!liftDraft.weight || !liftDraft.reps) return;
      const e1rm = C.estimate1RM(liftDraft.weight, liftDraft.reps, data.settings.formula);
      lift.weight = liftDraft.weight;
      lift.reps = liftDraft.reps;
      lift.bestWeight = liftDraft.weight;
      lift.bestReps = liftDraft.reps;
      lift.e1rm = e1rm;
      lift.trainingMax = C.trainingMax(e1rm, data.settings.trainingMaxPercent, data.settings.increment);
      lift.manualMax = true;
      lift.history = lift.history || [];
      lift.history.push({ date: liftDraft.date || new Date().toISOString().slice(0, 10), weight: liftDraft.weight, reps: liftDraft.reps, e1rm, source: "manual-max" });
    });
    S.save(data);
    workoutDraft = null;
    toast("Máximas salvas e cargas de treino atualizadas.");
    render();
  }

  function useHistoryMaxes() {
    if (!confirm("Voltar a calcular as máximas pela melhor série do histórico?")) return;
    Object.values(data.lifts).forEach((lift) => { lift.manualMax = false; });
    S.recomputeLifts(data);
    S.save(data);
    workoutDraft = null;
    toast("Máximas automáticas pelo histórico ativadas.");
    render();
  }

  function trainingPreview(key) {
    const lift = data.lifts[key];
    return `<article class="card">
      <h3>${lift.name}: cargas usadas no programa</h3>
      <p>70% do TM: <strong>${C.formatKg(C.workWeight(lift.trainingMax, 70, data.settings.increment))}</strong></p>
      <p>75% do TM: <strong>${C.formatKg(C.workWeight(lift.trainingMax, 75, data.settings.increment))}</strong></p>
      <p>80% do TM: <strong>${C.formatKg(C.workWeight(lift.trainingMax, 80, data.settings.increment))}</strong></p>
      <p>90% do TM: <strong>${C.formatKg(C.workWeight(lift.trainingMax, 90, data.settings.increment))}</strong></p>
    </article>`;
  }

  function treino() {
    const dayOptions = Object.entries(P.days).map(([key, day]) => `<button class="${data.program.activeDay === key ? "active" : ""}" data-day="${key}">${day.label.split("-")[0]}</button>`).join("");
    const workout = P.getWorkout(data, data.program.activeDay, data.program.currentWeek);
    if (!workoutDraft || workoutDraft.key !== `${data.program.activeDay}-${data.program.currentWeek}`) {
      workoutDraft = makeDraft(workout);
    }
    app().innerHTML = head("Treino", "Tela otimizada para registrar séries, RPE, vídeos, dor, falha técnica e resumo do treino.") + `
      <section class="card">
        <div class="toolbar">
          <div class="segmented">${dayOptions}</div>
          <label>Semana <input id="week-input" type="number" min="1" max="7" value="${data.program.currentWeek}"></label>
        </div>
      </section>
      <section class="card">
        <h2>${workout.label}: ${workout.title}</h2>
        ${workout.deload ? '<p class="notice">Deload: volume reduzido, intensidade menor e singles pesados removidos.</p>' : ""}
        <div class="grid">${workoutDraft.exercises.map(exerciseHtml).join("")}</div>
        <div class="toolbar" style="margin-top:16px">
          <button class="primary" id="finish-session">Finalizar treino</button>
          <button class="ghost" id="reset-draft">Recarregar previsão</button>
        </div>
      </section>
      <section class="card"><h2>Cronômetro de descanso</h2><div class="toolbar">
        ${data.settings.restTimes.map((sec) => `<button data-rest="${sec}">${sec / 60} min</button>`).join("")}
        <label>Personalizado (s)<input id="custom-rest" type="number" min="10" value="90"></label>
        <button id="custom-rest-start">Iniciar</button><strong id="rest-display">00:00</strong>
      </div></section>`;
    bindWorkout();
  }

  function makeDraft(workout) {
    return {
      key: `${workout.key}-${workout.week}`,
      startedAt: new Date().toISOString(),
      exercises: workout.exercises.map((exercise) => ({
        ...exercise,
        warmups: exercise.warmups || [],
        setsData: Array.from({ length: Number(exercise.setsPlanned || exercise.sets) || 1 }, () => ({
          weight: exercise.weight || "",
          reps: parseInt(exercise.reps, 10) || "",
          rpe: exercise.rpe || "",
          done: false,
          note: "",
          video: "",
          techniqueBreak: false,
          pain: false,
        })),
      })),
    };
  }

  function exerciseHtml(exercise, i) {
    return `<article class="exercise" data-exercise="${i}">
      <div class="exercise-head">
        <div><h3>${h(exercise.name)}</h3><span class="pill">${h(exercise.type)}</span></div>
        <div class="metric"><small>${exercise.percentUsed ? `${exercise.percentUsed}% do TM` : "Carga editável"}</small><strong>${exercise.weight ? C.formatKg(exercise.weight) : "Livre"}</strong></div>
      </div>
      <p class="muted">${exercise.setsPlanned || exercise.sets} x ${h(exercise.reps)} • RPE alvo ${exercise.rpe} • descanso ${h(exercise.rest)}. ${h(exercise.notes)}</p>
      ${exercise.warmups.length ? `<details><summary>Aquecimento automático</summary><div class="grid">${exercise.warmups.map((set, wi) => `<label class="checkline"><input type="checkbox" data-warmup="${wi}" ${set.done ? "checked" : ""}>${C.formatKg(set.weight)} x ${set.reps}</label>`).join("")}<button data-add-warmup>Adicionar aquecimento</button></div></details>` : ""}
      <div>${exercise.setsData.map((set, si) => setHtml(set, si)).join("")}</div>
    </article>`;
  }

  function setHtml(set, si) {
    return `<div class="set-row" data-set="${si}">
      <label>Peso<input data-field="weight" type="number" step="0.5" value="${h(set.weight)}"></label>
      <label>Reps<input data-field="reps" type="number" step="1" value="${h(set.reps)}"></label>
      <label>RPE<input data-field="rpe" type="number" step="0.5" min="1" max="10" value="${h(set.rpe)}"></label>
      <label class="checkline"><input data-field="done" type="checkbox" ${set.done ? "checked" : ""}>Concluída</label>
      <label>Vídeo/nota<input data-field="video" type="url" value="${h(set.video)}" placeholder="link do vídeo"></label>
      <label class="checkline"><input data-field="techniqueBreak" type="checkbox" ${set.techniqueBreak ? "checked" : ""}>Falha técnica</label>
      <label class="checkline"><input data-field="pain" type="checkbox" ${set.pain ? "checked" : ""}>Dor</label>
      <label>Obs.<input data-field="note" value="${h(set.note)}"></label>
    </div>`;
  }

  function bindWorkout() {
    document.querySelectorAll("[data-day]").forEach((button) => button.addEventListener("click", () => {
      data.program.activeDay = button.dataset.day;
      S.save(data);
      workoutDraft = null;
      render();
    }));
    document.getElementById("week-input").addEventListener("change", (event) => {
      data.program.currentWeek = Math.min(7, Math.max(1, Number(event.target.value)));
      S.save(data);
      workoutDraft = null;
      render();
    });
    document.querySelectorAll("[data-exercise]").forEach((exerciseNode) => {
      const exIndex = Number(exerciseNode.dataset.exercise);
      exerciseNode.addEventListener("input", (event) => updateDraft(event, exIndex));
      exerciseNode.addEventListener("change", (event) => updateDraft(event, exIndex));
      const add = exerciseNode.querySelector("[data-add-warmup]");
      if (add) add.addEventListener("click", () => {
        workoutDraft.exercises[exIndex].warmups.push({ weight: 20, reps: 5, done: false });
        render();
      });
    });
    document.getElementById("reset-draft").addEventListener("click", () => { workoutDraft = null; render(); });
    document.getElementById("finish-session").addEventListener("click", finishSession);
    document.querySelectorAll("[data-rest]").forEach((button) => button.addEventListener("click", () => startRest(Number(button.dataset.rest))));
    document.getElementById("custom-rest-start").addEventListener("click", () => startRest(Number(document.getElementById("custom-rest").value)));
  }

  function updateDraft(event, exIndex) {
    const setNode = event.target.closest("[data-set]");
    const warmupNode = event.target.closest("[data-warmup]");
    if (setNode) {
      const set = workoutDraft.exercises[exIndex].setsData[Number(setNode.dataset.set)];
      const field = event.target.dataset.field;
      set[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    }
    if (warmupNode) {
      workoutDraft.exercises[exIndex].warmups[Number(event.target.dataset.warmup)].done = event.target.checked;
    }
  }

  function startRest(seconds) {
    clearInterval(restTimer);
    restLeft = Math.max(10, seconds || 90);
    tickRest();
    restTimer = setInterval(() => {
      restLeft -= 1;
      tickRest();
      if (restLeft <= 0) {
        clearInterval(restTimer);
        toast("Descanso finalizado.");
      }
    }, 1000);
  }

  function tickRest() {
    const min = String(Math.floor(restLeft / 60)).padStart(2, "0");
    const sec = String(restLeft % 60).padStart(2, "0");
    const node = document.getElementById("rest-display");
    if (node) node.textContent = `${min}:${sec}`;
  }

  function finishSession() {
    const sets = workoutDraft.exercises.flatMap((exercise) => exercise.setsData.map((set) => ({ ...set, lift: exercise.lift, exercise: exercise.name })));
    const completed = sets.filter((set) => set.done);
    const volume = completed.reduce((sum, set) => sum + C.setVolume(set.weight, set.reps), 0);
    const maxWeight = completed.reduce((max, set) => Math.max(max, Number(set.weight) || 0), 0);
    const maxE1rm = completed.reduce((max, set) => Math.max(max, C.estimate1RM(set.weight, set.reps, data.settings.formula)), 0);
    const avgRpe = C.average(completed.map((set) => set.rpe));
    const recommendation = C.progressionRecommendation(completed, completed[0] && completed[0].lift, data.settings.progression);
    const session = {
      id: S.id("session"),
      date: new Date().toISOString().slice(0, 10),
      week: data.program.currentWeek,
      day: data.program.activeDay,
      title: P.days[data.program.activeDay].title,
      exercises: workoutDraft.exercises,
      summary: {
        volume,
        completedSets: completed.length,
        maxWeight,
        maxE1rm,
        avgRpe,
        durationMin: Math.max(1, Math.round((Date.now() - new Date(workoutDraft.startedAt).getTime()) / 60000)),
        recommendation: recommendation.text,
      },
    };
    data.sessions.push(session);
    completed.filter((set) => set.lift).forEach((set) => {
      const lift = data.lifts[set.lift];
      lift.history = lift.history || [];
      lift.history.push({ date: session.date, weight: Number(set.weight), reps: Number(set.reps), e1rm: C.estimate1RM(set.weight, set.reps, data.settings.formula) });
    });
    S.recomputeLifts(data);
    S.save(data);
    workoutDraft = null;
    toast(`Treino salvo. ${recommendation.text}`);
    route = "historico";
    renderNav();
    render();
  }

  function historico() {
    app().innerHTML = head("Histórico", "Treinos salvos no navegador, com filtros, edição básica, exclusão, duplicação e exportação.") + `
      <section class="card form-grid">
        <label>Filtrar exercício<input id="filter-exercise" placeholder="ex.: supino"></label>
        <label>Filtrar bloco/semana<input id="filter-week" type="number" min="1" max="7"></label>
        <button id="export-data">Exportar JSON</button>
      </section>
      <section class="card"><h2>Registros</h2><div id="history-list">${historyList(data.sessions)}</div></section>
      <section class="card"><h2>Melhores por levantamento</h2><div class="grid cols-3">${["squat", "bench", "deadlift"].map(liftStats).join("")}</div></section>`;
    document.getElementById("filter-exercise").addEventListener("input", filterHistory);
    document.getElementById("filter-week").addEventListener("input", filterHistory);
    document.getElementById("export-data").addEventListener("click", downloadJson);
    bindHistoryActions();
  }

  function historyList(items) {
    if (!items.length) return '<p class="empty">Nenhum treino registrado ainda.</p>';
    return `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Treino</th><th>Volume</th><th>Maior carga</th><th>e1RM</th><th>RPE</th><th>Ações</th></tr></thead><tbody>${items.map((session) => `
      <tr><td>${session.date}</td><td>${h(session.title)}<br><span class="muted">Semana ${session.week}</span><details><summary>Detalhes, notas e vídeos</summary>${sessionDetails(session)}</details></td><td>${Math.round(session.summary.volume)} kg</td><td>${C.formatKg(session.summary.maxWeight)}</td><td>${C.formatKg(session.summary.maxE1rm)}</td><td>${Math.round(session.summary.avgRpe * 10) / 10}</td><td><button data-edit="${session.id}">Editar</button> <button data-dup="${session.id}">Duplicar</button> <button class="danger" data-delete="${session.id}">Excluir</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  function sessionDetails(session) {
    return session.exercises.map((exercise) => {
      const rows = exercise.setsData.map((set, index) => {
        const e1rm = set.weight && set.reps ? C.estimate1RM(set.weight, set.reps, data.settings.formula) : 0;
        const video = set.video ? `<a href="${h(set.video)}" target="_blank" rel="noreferrer">vídeo</a>` : "sem vídeo";
        return `<li>Série ${index + 1}: ${C.formatKg(set.weight)} x ${h(set.reps)}, RPE ${h(set.rpe)}, e1RM ${C.formatKg(e1rm)} • ${video}${set.note ? ` • ${h(set.note)}` : ""}${set.techniqueBreak ? " • falha técnica" : ""}${set.pain ? " • dor/desconforto" : ""}</li>`;
      }).join("");
      return `<strong>${h(exercise.name)}</strong><ul>${rows}</ul>`;
    }).join("");
  }

  function liftStats(key) {
    const lift = data.lifts[key];
    const freq = data.sessions.filter((s) => JSON.stringify(s.exercises).includes(key)).length;
    return `<article class="card"><h3>${lift.name}</h3><p>Maior peso: <strong>${C.formatKg(lift.bestWeight)}</strong></p><p>Maior e1RM: <strong>${C.formatKg(lift.e1rm)}</strong></p><p>Frequência registrada: ${freq} treinos</p></article>`;
  }

  function filterHistory() {
    const text = document.getElementById("filter-exercise").value.toLowerCase();
    const week = document.getElementById("filter-week").value;
    const filtered = data.sessions.filter((session) => {
      const matchesText = !text || JSON.stringify(session.exercises).toLowerCase().includes(text);
      const matchesWeek = !week || Number(session.week) === Number(week);
      return matchesText && matchesWeek;
    });
    document.getElementById("history-list").innerHTML = historyList(filtered);
    bindHistoryActions();
  }

  function bindHistoryActions() {
    document.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => {
      const session = data.sessions.find((item) => item.id === button.dataset.edit);
      const date = prompt("Data do treino (AAAA-MM-DD)", session.date);
      if (!date) return;
      const title = prompt("Título do treino", session.title);
      if (!title) return;
      const week = prompt("Semana do bloco", session.week);
      session.date = date;
      session.title = title;
      session.week = Number(week) || session.week;
      S.save(data);
      toast("Registro editado.");
      render();
    }));
    document.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
      if (!confirm("Excluir este treino?")) return;
      data.sessions = data.sessions.filter((session) => session.id !== button.dataset.delete);
      S.save(data);
      render();
    }));
    document.querySelectorAll("[data-dup]").forEach((button) => button.addEventListener("click", () => {
      const found = data.sessions.find((session) => session.id === button.dataset.dup);
      data.sessions.push({ ...JSON.parse(JSON.stringify(found)), id: S.id("session"), date: new Date().toISOString().slice(0, 10) });
      S.save(data);
      toast("Treino duplicado.");
      render();
    }));
  }

  function progressao() {
    app().innerHTML = head("Progressão", "Acompanhe volume, RPE, aderência, total estimado e regras editáveis de progressão.") + `
      <section class="card toolbar"><div class="segmented"><button data-weeks="4">4 semanas</button><button data-weeks="8">8 semanas</button><button data-weeks="12">12 semanas</button><button data-weeks="all" class="active">Todo período</button></div></section>
      <section class="grid cols-3">
        <article class="card"><h2>Volume semanal</h2><canvas id="chart-volume"></canvas></article>
        <article class="card"><h2>RPE médio</h2><canvas id="chart-rpe"></canvas></article>
        <article class="card"><h2>Total estimado</h2><canvas id="chart-total"></canvas></article>
      </section>
      <section class="card"><h2>Regras atuais</h2><p>RPE médio até 8 e tudo concluído: aumentar. RPE 9: manter. Falha, dor, RPE 10 ou quebra técnica: repetir; se ocorrer duas semanas seguidas, reduzir 7,5% a 10%.</p></section>`;
    document.querySelectorAll("[data-weeks]").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll("[data-weeks]").forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      Charts.renderProgress(data, button.dataset.weeks);
    }));
    Charts.renderProgress(data, "all");
  }

  function competicao() {
    const comp = data.competitions[0] || {};
    const daysLeft = comp.date ? Math.ceil((new Date(comp.date) - new Date()) / 86400000) : null;
    const phase = daysLeft === null ? "Cadastre uma data" : P.competitionPhases(daysLeft);
    const attempts = Object.entries(data.lifts).map(([key, lift]) => {
      const a = P.attempts(lift.e1rm, data.settings.increment);
      return `<tr><td>${lift.name}</td><td><input data-attempt="${key}.opener" value="${a.opener}"></td><td><input data-attempt="${key}.second" value="${a.second}"></td><td><input data-attempt="${key}.third" value="${a.third}"></td></tr>`;
    }).join("");
    app().innerHTML = head("Competição", "Planeje campeonato, tentativas, checklist e modo de preparação de 8 semanas.") + `
      <section class="card form-grid" id="competition-form">
        ${input("Nome", "name", comp.name)}${input("Federação", "federation", comp.federation)}${input("Data", "date", comp.date, "date")}
        ${input("Cidade", "city", comp.city)}${input("Categoria", "category", comp.category)}${input("Peso-alvo", "targetWeight", comp.targetWeight, "number")}
        ${select("Modalidade", "mode", comp.mode || "Raw", ["Raw", "Equipado"])}${select("Exige IPF Approved", "ipf", comp.ipf || "Não informado", ["Não informado", "Sim", "Não"])}${input("Data da pesagem", "weighIn", comp.weighIn, "date")}
        <label>Observações<textarea data-comp="notes">${h(comp.notes)}</textarea></label>
        <button class="primary" id="save-comp">Salvar competição</button>
      </section>
      <section class="grid cols-2">
        <article class="card"><h2>Contagem regressiva</h2><p><strong>${daysLeft === null ? "-" : `${daysLeft} dias`}</strong></p><p class="muted">${phase}${daysLeft !== null && daysLeft <= 56 && daysLeft >= 0 ? " • modo de preparação disponível." : ""}</p></article>
        <article class="card"><h2>Checklist</h2>${["Singlet","Camiseta","Meias para o terra","Cinto","Joelheiras","Munhequeiras","Documento","Alimentação","Água","Equipamento aprovado","Horários","Pesagem"].map((item) => `<label class="checkline"><input type="checkbox">${item}</label>`).join("")}</article>
      </section>
      <section class="card"><h2>Calculadora de tentativas</h2><div class="table-wrap"><table><thead><tr><th>Levantamento</th><th>1ª (88%-92%)</th><th>2ª (96%-100%)</th><th>3ª</th></tr></thead><tbody>${attempts}</tbody></table></div><p id="attempt-total" class="notice"></p></section>
      <section class="card"><h2>Equipamentos</h2>${equipmentForm()}${equipmentList()}</section>`;
    document.getElementById("save-comp").addEventListener("click", saveCompetition);
    document.querySelectorAll("[data-attempt]").forEach((input) => input.addEventListener("input", updateAttemptTotal));
    document.getElementById("add-equipment").addEventListener("click", addEquipment);
    bindEquipmentDelete();
    updateAttemptTotal();
  }

  function input(label, field, value = "", type = "text") {
    const attr = field ? `data-comp="${field}"` : "";
    return `<label>${label}<input ${attr} type="${type}" value="${h(value)}"></label>`;
  }

  function select(label, field, value, options) {
    return `<label>${label}<select data-comp="${field}">${options.map((option) => `<option ${option === value ? "selected" : ""}>${option}</option>`).join("")}</select></label>`;
  }

  function saveCompetition() {
    const comp = data.competitions[0] || { id: S.id("competition") };
    document.querySelectorAll("[data-comp]").forEach((field) => { comp[field.dataset.comp] = field.value; });
    data.competitions[0] = comp;
    S.save(data);
    toast("Competição salva.");
    render();
  }

  function updateAttemptTotal() {
    const thirds = [...document.querySelectorAll('[data-attempt$=".third"]')].map((input) => Number(input.value) || 0);
    const planned = thirds.reduce((sum, item) => sum + item, 0);
    const conservative = [...document.querySelectorAll('[data-attempt$=".opener"]')].reduce((sum, input) => sum + (Number(input.value) || 0), 0);
    const node = document.getElementById("attempt-total");
    if (node) node.textContent = `Total conservador: ${C.formatKg(conservative)} • total planejado: ${C.formatKg(planned)}. Ajuste manualmente conforme o dia.`;
  }

  function equipmentForm() {
    return `<div class="form-grid">
      <label>Tipo<input id="eq-type" placeholder="cinto, joelheiras, tênis"></label>
      <label>Marca<input id="eq-brand"></label>
      <label>Modelo<input id="eq-model"></label>
      <label>Tamanho<input id="eq-size"></label>
      <label>Espessura<input id="eq-thickness"></label>
      <label>IPF Approved<select id="eq-ipf"><option>Não informado</option><option>Sim</option><option>Não</option></select></label>
      <label>Data de compra<input id="eq-date" type="date"></label>
      <label>Preço<input id="eq-price" type="number" step="0.01"></label>
      <label>Link<input id="eq-link" type="url"></label>
      <label>Observações<textarea id="eq-notes"></textarea></label>
      <button id="add-equipment">Adicionar equipamento</button>
    </div><p class="muted">O status IPF Approved deve ser informado pelo usuário; o app não homologa marcas automaticamente.</p>`;
  }

  function equipmentList() {
    if (!data.equipment.length) return '<p class="empty">Nenhum equipamento cadastrado.</p>';
    return `<div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Marca/modelo</th><th>IPF</th><th>Link</th><th></th></tr></thead><tbody>${data.equipment.map((item) => `<tr><td>${h(item.type)}</td><td>${h(item.brand)} ${h(item.model)}<br><span class="muted">${h(item.size)} ${h(item.thickness)}</span></td><td>${h(item.ipf)}</td><td>${item.link ? `<a href="${h(item.link)}" target="_blank" rel="noreferrer">abrir</a>` : "-"}</td><td><button class="danger" data-eq-delete="${item.id}">Excluir</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  function addEquipment() {
    data.equipment.push({
      id: S.id("equipment"),
      type: document.getElementById("eq-type").value,
      brand: document.getElementById("eq-brand").value,
      model: document.getElementById("eq-model").value,
      size: document.getElementById("eq-size").value,
      thickness: document.getElementById("eq-thickness").value,
      ipf: document.getElementById("eq-ipf").value,
      date: document.getElementById("eq-date").value,
      price: document.getElementById("eq-price").value,
      link: document.getElementById("eq-link").value,
      notes: document.getElementById("eq-notes").value,
    });
    S.save(data);
    toast("Equipamento cadastrado.");
    render();
  }

  function bindEquipmentDelete() {
    document.querySelectorAll("[data-eq-delete]").forEach((button) => button.addEventListener("click", () => {
      if (!confirm("Excluir equipamento?")) return;
      data.equipment = data.equipment.filter((item) => item.id !== button.dataset.eqDelete);
      S.save(data);
      render();
    }));
  }

  function configuracoes() {
    app().innerHTML = head("Configurações", "Perfil, fórmulas, Training Max, incremento, progressão, peso corporal e dados.") + `
      <section class="card form-grid" id="settings-form">
        <label>Nome<input data-setting="profile.name" value="${h(data.profile.name)}"></label>
        <label>Altura (m)<input data-setting="profile.height" type="number" step="0.01" value="${h(data.profile.height)}"></label>
        <label>Peso inicial<input data-setting="profile.initialBodyweight" type="number" step="0.1" value="${h(data.profile.initialBodyweight)}"></label>
        <label>Meta mínima<input data-setting="profile.targetWeightMin" type="number" step="0.1" value="${h(data.profile.targetWeightMin)}"></label>
        <label>Meta máxima<input data-setting="profile.targetWeightMax" type="number" step="0.1" value="${h(data.profile.targetWeightMax)}"></label>
        <label>Unidade<select data-setting="settings.unit"><option ${data.settings.unit === "kg" ? "selected" : ""}>kg</option><option ${data.settings.unit === "lb" ? "selected" : ""}>lb</option></select></label>
        <label>Fórmula e1RM<select data-setting="settings.formula"><option value="epley">Epley</option><option value="brzycki" ${data.settings.formula === "brzycki" ? "selected" : ""}>Brzycki</option><option value="lombardi" ${data.settings.formula === "lombardi" ? "selected" : ""}>Lombardi</option></select></label>
        <label>Training Max (%)<input data-setting="settings.trainingMaxPercent" type="number" min="80" max="100" value="${h(data.settings.trainingMaxPercent)}"></label>
        <label>Incremento<select data-setting="settings.increment">${[1,1.25,2,2.5,5].map((v) => `<option value="${v}" ${Number(data.settings.increment) === v ? "selected" : ""}>${v} kg</option>`).join("")}</select></label>
        <label>Progressão agachamento<input data-setting="settings.progression.squat.increase" type="number" step="0.5" value="${h(data.settings.progression.squat.increase)}"></label>
        <label>Progressão supino<input data-setting="settings.progression.bench.increase" type="number" step="0.5" value="${h(data.settings.progression.bench.increase)}"></label>
        <label>Progressão terra<input data-setting="settings.progression.deadlift.increase" type="number" step="0.5" value="${h(data.settings.progression.deadlift.increase)}"></label>
        <button class="primary" id="save-settings">Salvar configurações</button>
      </section>
      <section class="card"><h2>Peso corporal</h2>${bodyweightForm()}${bodyweightStats()}</section>
      <section class="card"><h2>Importação e exportação</h2><div class="toolbar"><button id="download-json">Exportar JSON</button><label>Importar JSON<textarea id="import-json" placeholder="cole o backup aqui"></textarea></label><button id="import-button">Importar</button><button class="danger" id="clear-data">Reiniciar dados</button></div></section>
      <section class="notice">Alterações relevantes de peso, alimentação ou saúde devem ser acompanhadas por profissional qualificado.</section>`;
    document.getElementById("save-settings").addEventListener("click", saveSettings);
    document.getElementById("add-bodyweight").addEventListener("click", addBodyweight);
    document.getElementById("download-json").addEventListener("click", downloadJson);
    document.getElementById("import-button").addEventListener("click", importJson);
    document.getElementById("clear-data").addEventListener("click", clearData);
  }

  function bodyweightForm() {
    return `<div class="form-grid"><label>Data<input id="bw-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label><label>Peso<input id="bw-weight" type="number" step="0.1"></label><label>Cintura<input id="bw-waist" type="number" step="0.1"></label><label>Observação<input id="bw-notes"></label><button id="add-bodyweight">Registrar peso</button></div>`;
  }

  function bodyweightStats() {
    const last = currentBodyweight();
    const last7 = data.bodyweight.slice(-7);
    const avg7 = C.average(last7.map((item) => item.weight));
    const previous = data.bodyweight[data.bodyweight.length - 8];
    const variation = previous ? last.weight - previous.weight : 0;
    const targetDistance = last.weight - data.profile.targetWeightMax;
    return `<div class="grid cols-4">${metric("Média 7 dias", C.formatKg(avg7 || last.weight))}${metric("Variação semanal", `${variation >= 0 ? "+" : ""}${C.formatKg(variation)}`)}${metric("Distância da meta", C.formatKg(Math.max(0, targetDistance)))}${metric("Categoria estimada", last.weight <= 93 ? "até 93 kg" : "acima de 93 kg")}</div>`;
  }

  function saveSettings() {
    document.querySelectorAll("[data-setting]").forEach((field) => {
      const path = field.dataset.setting.split(".");
      let target = data;
      path.slice(0, -1).forEach((part) => { target = target[part]; });
      const value = field.type === "number" || !Number.isNaN(Number(field.value)) && field.value !== "" ? Number(field.value) : field.value;
      target[path[path.length - 1]] = value;
    });
    S.recomputeLifts(data);
    S.save(data);
    toast("Configurações salvas.");
    render();
  }

  function addBodyweight() {
    const weight = Number(document.getElementById("bw-weight").value);
    if (!weight) return toast("Informe o peso corporal.");
    data.bodyweight.push({ date: document.getElementById("bw-date").value, weight, waist: document.getElementById("bw-waist").value, notes: document.getElementById("bw-notes").value });
    S.save(data);
    toast("Peso corporal registrado.");
    render();
  }

  function downloadJson() {
    const blob = new Blob([S.exportJson(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `power-treino-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson() {
    try {
      data = S.importJson(document.getElementById("import-json").value);
      toast("Backup importado.");
      render();
    } catch {
      toast("JSON inválido.");
    }
  }

  function clearData() {
    if (!confirm("Limpar todos os dados e restaurar o perfil inicial?")) return;
    data = S.clearAll();
    workoutDraft = null;
    render();
  }

  function render() {
    if (route === "dashboard") dashboard();
    if (route === "maximas") maximas();
    if (route === "treino") treino();
    if (route === "historico") historico();
    if (route === "progressao") progressao();
    if (route === "competicao") competicao();
    if (route === "configuracoes") configuracoes();
    app().focus({ preventScroll: true });
  }

  window.PowerTreino = window.PowerTreino || {};
  window.PowerTreino.UI = { init, render };
})();
