const { app } = require('./app');
const { assertEnvironment, env } = require('./config/env');
const { runMigrations } = require('./config/migrate');
const { startJobs } = require('./jobs');

assertEnvironment();

// Aplica migrações pendentes antes de aceitar tráfego, para o código novo nunca consultar uma
// coluna que o banco ainda não tem (o que dava 500 na tela de Configurações após um deploy).
async function start() {
  try {
    const { applied } = await runMigrations();
    if (applied.length) console.log(`Migrações aplicadas: ${applied.join(', ')}`);
  } catch (error) {
    console.error('Falha ao aplicar migrações:', error.message);
    process.exit(1);
  }
  app.listen(env.port, () => {
    console.log(`API iniciada na porta ${env.port}`);
  });
  startJobs();
}

start();
