const { env } = require('../config/env');
const { processDueDispatches } = require('./marketing.job');

let timer;
let running = false;

async function runJobs() {
  if (running) return;
  running = true;
  try {
    await processDueDispatches();
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
