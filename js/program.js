(function () {
  const C = window.PowerTreino.Calculations;

  const days = {
    monday: {
      label: "Segunda-feira",
      title: "Agachamento pesado + supino volume",
      exercises: [
        main("squat", "Agachamento competição", "competição", 90, "1", "1", 8, "3 a 5 min", "Single técnico, sem testar máximo."),
        main("squat", "Agachamento competição", "competição", 75, "4", "4", 7.5, "3 min", "Manter padrão de competição."),
        main("bench", "Supino competição", "competição", 70, "4", "6", 7, "2 a 3 min", "Pausa clara no peito."),
        accessory("Leg press", "3", "10"),
        accessory("Mesa flexora", "3", "12"),
        accessory("Prancha com carga", "3", "30 a 45 s"),
      ],
    },
    tuesday: {
      label: "Terça-feira",
      title: "Terra pesado + costas",
      exercises: [
        main("deadlift", "Levantamento terra competição", "competição", 90, "1", "1", 8, "3 a 5 min", "Single técnico saindo parado do chão."),
        main("deadlift", "Levantamento terra competição", "competição", 80, "5", "3", 8, "3 min", "Evitar touch-and-go."),
        accessory("Remada curvada", "4", "8"),
        accessory("Puxada alta ou barra fixa assistida", "4", "8 a 10"),
        accessory("Face pull", "3", "15"),
        accessory("Rosca direta", "3", "10"),
      ],
    },
    thursday: {
      label: "Quinta-feira",
      title: "Supino pesado + ombros e tríceps",
      exercises: [
        main("bench", "Supino competição", "competição", 90, "1", "1", 8, "3 a 5 min", "Single técnico."),
        main("bench", "Supino competição", "competição", 80, "5", "3", 8, "3 min", "Barra estável e pausa consistente."),
        main("bench", "Supino pausado longo", "variação", 70, "3", "5", 7, "2 a 3 min", "Pausa de 2 segundos."),
        accessory("Desenvolvimento militar", "3", "6"),
        accessory("Tríceps na polia", "4", "10 a 12"),
        accessory("Elevação lateral", "3", "15"),
      ],
    },
    friday: {
      label: "Sexta-feira",
      title: "Agachamento volume + terra técnico",
      exercises: [
        main("squat", "Agachamento", "competição", 70, "4", "6", 7, "2 a 3 min", "Volume controlado."),
        main("deadlift", "Terra técnico", "variação", 70, "4", "5", 7, "2 a 3 min", "Cada repetição começa parada no chão."),
        accessory("Bulgarian split squat", "3", "8 por perna"),
        accessory("Mesa flexora", "3", "12"),
        accessory("Abdominal no cabo", "4", "10 a 15"),
      ],
    },
  };

  function main(lift, name, type, percent, sets, reps, rpe, rest, notes) {
    return { lift, name, type, percent, sets, reps, rpe, rest, notes, main: true };
  }

  function accessory(name, sets, reps) {
    return { lift: null, name, type: "acessório", percent: null, sets, reps, rpe: 8, rest: "1 a 2 min", notes: "", main: false };
  }

  function weekMultiplier(week) {
    const progression = [0, 0.025, 0.05, 0.075, 0.1, 0.125];
    if (Number(week) >= 7) return { intensity: 0.9, volume: 0.6, deload: true };
    return { intensity: 1 + (progression[Math.max(0, Number(week) - 1)] || 0), volume: 1, deload: false };
  }

  function plannedExercise(exercise, data, week) {
    const mult = weekMultiplier(week);
    const copy = { ...exercise };
    if (copy.main) {
      const tm = data.lifts[copy.lift].trainingMax;
      const percent = mult.deload ? Math.max(copy.percent - 10, 50) : copy.percent;
      copy.percentUsed = percent;
      copy.weight = C.workWeight(tm * mult.intensity, percent, data.settings.increment);
      copy.setsPlanned = Math.max(1, Math.round(Number(copy.sets) * mult.volume));
      copy.singleRemoved = mult.deload && copy.sets === "1" && copy.reps === "1";
      copy.warmups = copy.singleRemoved ? [] : C.warmups(copy.lift, copy.weight, data.settings.increment);
    } else {
      copy.weight = "";
      copy.setsPlanned = Math.max(1, Math.round(Number(copy.sets) * mult.volume));
      copy.percentUsed = null;
      copy.warmups = [];
    }
    return copy;
  }

  function getWorkout(data, dayKey, week) {
    const day = days[dayKey] || days.monday;
    return {
      key: dayKey,
      label: day.label,
      title: day.title,
      week,
      deload: weekMultiplier(week).deload,
      exercises: day.exercises.map((exercise) => plannedExercise(exercise, data, week))
        .filter((exercise) => !exercise.singleRemoved),
    };
  }

  function nextWorkoutKey() {
    const day = new Date().getDay();
    if (day <= 1) return "monday";
    if (day === 2) return "tuesday";
    if (day <= 4) return "thursday";
    return "friday";
  }

  function competitionPhases(daysLeft) {
    if (daysLeft > 56) return "Base";
    if (daysLeft > 35) return "Base e intensificação";
    if (daysLeft > 21) return "Intensificação";
    if (daysLeft > 7) return "Pico e taper";
    if (daysLeft >= 0) return "Semana da competição";
    return "Competição encerrada";
  }

  function attempts(max, increment) {
    return {
      opener: C.roundToIncrement(max * 0.9, increment),
      second: C.roundToIncrement(max * 0.98, increment),
      third: C.roundToIncrement(max * 1.03, increment),
    };
  }

  window.PowerTreino = window.PowerTreino || {};
  window.PowerTreino.Program = {
    days,
    getWorkout,
    nextWorkoutKey,
    weekMultiplier,
    competitionPhases,
    attempts,
  };
})();
