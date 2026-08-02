const { env } = require('../config/env');
const { processDueDispatches } = require('./marketing.job');
const { applyScheduledDowngrades } = require('../services/plan-upgrade');

let timer;
let running = false;

async function runJobs() {
  if (running) return;
  running = true;
  try {
    await processDueDispatches();
    // Downgrades marcados para a renovação: aplica os que já chegaram na data.
    const aplicados = await applyScheduledDowngrades();
    if (aplicados.length) console.log(`Downgrades aplicados na renovação: ${aplicados.length}`);
  } catch (error) {
    console.error('Falha em tarefa agendada:', String(error?.message || error).slice(0, 300));
  } finally {
    running = false;
  }
}

function startJobs() {
  if (!env.jobs.enabled || timer) return null;
  timer = setInterval(runJobs, env.jobs.intervalMinutes * 60_000);
  timer.unref();
  void runJobs();
  return timer;
}

function stopJobs() {
  if (timer) clearInterval(timer);
  timer = undefined;
}

module.exports = { startJobs, stopJobs, runJobs };
