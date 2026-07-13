(function () {
  const formulas = {
    epley(weight, reps) {
      return weight * (1 + reps / 30);
    },
    brzycki(weight, reps) {
      if (reps <= 1) return weight;
      return weight * (36 / (37 - reps));
    },
    lombardi(weight, reps) {
      return weight * Math.pow(reps, 0.1);
    },
  };

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function roundToIncrement(value, increment = 2.5) {
    const inc = Math.max(number(increment, 2.5), 0.1);
    return Math.round(number(value) / inc) * inc;
  }

  function formatKg(value) {
    const rounded = Math.round(number(value) * 10) / 10;
    return `${rounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
  }

  function estimate1RM(weight, reps, formula = "epley") {
    const fn = formulas[formula] || formulas.epley;
    return fn(Math.max(number(weight), 0), Math.max(number(reps, 1), 1));
  }

  function trainingMax(e1rm, percent = 90, increment = 2.5) {
    return roundToIncrement(number(e1rm) * (number(percent, 90) / 100), increment);
  }

  function setVolume(weight, reps, sets = 1) {
    return number(weight) * number(reps) * number(sets, 1);
  }

  function bestSet(sets, formula = "epley") {
    return (sets || []).reduce((best, set) => {
      const e1rm = estimate1RM(set.weight, set.reps, formula);
      return e1rm > best.e1rm ? { ...set, e1rm } : best;
    }, { weight: 0, reps: 0, e1rm: 0 });
  }

  function workWeight(tm, percent, increment = 2.5) {
    return roundToIncrement(number(tm) * (number(percent) / 100), increment);
  }

  function warmups(lift, targetWeight, increment = 2.5) {
    const target = number(targetWeight);
    if (target <= 0) return [];
    const isDeadlift = lift === "deadlift";
    const emptyBar = 20;
    const steps = isDeadlift
      ? [
          { percent: 50, reps: 5 },
          { percent: 60, reps: 3 },
          { percent: 72, reps: 2 },
          { percent: 82, reps: 1 },
          { percent: 90, reps: 1 },
        ]
      : [
          { fixed: emptyBar, reps: 10 },
          { percent: 40, reps: 5 },
          { percent: 55, reps: 3 },
          { percent: 70, reps: 2 },
          { percent: 80, reps: 1 },
          { percent: 90, reps: 1 },
        ];

    const seen = new Set();
    return steps
      .map((step) => {
        const raw = step.fixed || target * (step.percent / 100);
        const minDeadlift = isDeadlift ? Math.min(target, Math.max(40, target * 0.5)) : raw;
        const weight = roundToIncrement(step.fixed || Math.max(raw, minDeadlift), increment);
        return { weight: Math.min(weight, target), reps: step.reps, done: false };
      })
      .filter((set) => {
        const key = `${set.weight}-${set.reps}`;
        if (set.weight >= target || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function average(values) {
    const nums = values.map((v) => number(v)).filter((v) => v > 0);
    if (!nums.length) return 0;
    return nums.reduce((sum, item) => sum + item, 0) / nums.length;
  }

  function progressionRecommendation(completedSets, liftKey, rules) {
    const sets = completedSets || [];
    const avgRpe = average(sets.map((set) => set.rpe));
    const failed = sets.some((set) => set.failed || set.pain || set.techniqueBreak || !set.done);
    const hasRpe10 = sets.some((set) => number(set.rpe) >= 10);
    const hasRpe9 = sets.some((set) => number(set.rpe) >= 9);
    const liftRules = rules[liftKey] || rules.squat;

    if (failed || hasRpe10) {
      return {
        action: "repeat_or_reduce",
        amount: 0,
        text: "Repetir a semana. Se isso ocorrer por duas semanas seguidas, reduzir de 7,5% a 10%.",
      };
    }
    if (hasRpe9) {
      return { action: "hold", amount: 0, text: "Manter a carga na próxima semana." };
    }
    if (sets.length && avgRpe <= 8 && sets.every((set) => set.done)) {
      return {
        action: "increase",
        amount: number(liftRules.increase),
        text: `Adicionar ${formatKg(liftRules.increase)} na próxima semana.`,
      };
    }
    return { action: "review", amount: 0, text: "Revisar execução antes de progredir." };
  }

  window.PowerTreino = window.PowerTreino || {};
  window.PowerTreino.Calculations = {
    formulas,
    roundToIncrement,
    formatKg,
    estimate1RM,
    trainingMax,
    setVolume,
    bestSet,
    workWeight,
    warmups,
    average,
    progressionRecommendation,
    number,
  };
})();
