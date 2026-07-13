(function () {
  const STORAGE_KEY = "powerTreino.data.v1";
  const { estimate1RM, trainingMax, roundToIncrement } = window.PowerTreino.Calculations;

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function defaultData() {
    const settings = {
      unit: "kg",
      formula: "epley",
      trainingMaxPercent: 90,
      increment: 2.5,
      theme: "dark",
      restTimes: [60, 120, 180, 300],
      trainingDays: ["Segunda", "Terça", "Quinta", "Sexta"],
      progression: {
        squat: { increase: 2.5 },
        bench: { increase: 2.5 },
        deadlift: { increase: 5 },
      },
    };
    const initial = {
      squat: { name: "Agachamento", weight: 110, reps: 3 },
      bench: { name: "Supino", weight: 90, reps: 2 },
      deadlift: { name: "Terra", weight: 110, reps: 1 },
    };
    const lifts = Object.fromEntries(Object.entries(initial).map(([key, lift]) => {
      const e1rm = estimate1RM(lift.weight, lift.reps, settings.formula);
      return [key, {
        ...lift,
        bestWeight: lift.weight,
        bestReps: lift.reps,
        e1rm,
        trainingMax: trainingMax(e1rm, settings.trainingMaxPercent, settings.increment),
        history: [{ date: today(), weight: lift.weight, reps: lift.reps, e1rm }],
      }];
    }));

    return {
      version: 1,
      profile: {
        name: "Gustavo",
        height: 1.7,
        initialBodyweight: 100,
        targetWeightMin: 92,
        targetWeightMax: 93,
        sport: "Powerlifting Raw",
        goal: "Competir em campeonato regional em aproximadamente 1 ano",
      },
      settings,
      lifts,
      program: { currentWeek: 1, blockLength: 7, activeDay: "monday", customWarmups: {} },
      sessions: [],
      bodyweight: [{ date: today(), weight: 100, waist: "", notes: "Registro inicial" }],
      competitions: [],
      equipment: [],
    };
  }

  function normalize(data) {
    const base = defaultData();
    const merged = {
      ...base,
      ...data,
      profile: { ...base.profile, ...(data && data.profile) },
      settings: { ...base.settings, ...(data && data.settings) },
      program: { ...base.program, ...(data && data.program) },
    };
    merged.settings.progression = {
      ...base.settings.progression,
      ...(data && data.settings && data.settings.progression),
    };
    merged.lifts = data && data.lifts ? data.lifts : base.lifts;
    return merged;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const data = defaultData();
        save(data);
        return data;
      }
      return normalize(JSON.parse(raw));
    } catch (error) {
      console.error("Erro ao carregar dados", error);
      return defaultData();
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  function update(mutator) {
    const data = load();
    mutator(data);
    data.updatedAt = new Date().toISOString();
    return save(data);
  }

  function removeCollectionItem(collection, id) {
    return update((data) => {
      data[collection] = data[collection].filter((item) => item.id !== id);
    });
  }

  function exportJson(data) {
    return JSON.stringify(data || load(), null, 2);
  }

  function importJson(json) {
    const parsed = normalize(JSON.parse(json));
    save(parsed);
    return parsed;
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    return load();
  }

  function id(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function recomputeLifts(data) {
    Object.values(data.lifts).forEach((lift) => {
      const best = (lift.history || []).reduce((current, item) => {
        const e1rm = estimate1RM(item.weight, item.reps, data.settings.formula);
        return e1rm > current.e1rm ? { ...item, e1rm } : current;
      }, { weight: lift.weight, reps: lift.reps, e1rm: 0 });
      lift.bestWeight = best.weight || lift.bestWeight;
      lift.bestReps = best.reps || lift.bestReps;
      lift.e1rm = best.e1rm || estimate1RM(lift.weight, lift.reps, data.settings.formula);
      lift.trainingMax = roundToIncrement(
        lift.e1rm * (data.settings.trainingMaxPercent / 100),
        data.settings.increment
      );
    });
  }

  window.PowerTreino = window.PowerTreino || {};
  window.PowerTreino.Storage = {
    STORAGE_KEY,
    defaultData,
    load,
    save,
    update,
    removeCollectionItem,
    exportJson,
    importJson,
    clearAll,
    id,
    recomputeLifts,
  };
})();
