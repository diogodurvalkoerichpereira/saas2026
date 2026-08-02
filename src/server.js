const { app } = require('./app');
const { assertEnvironment, env } = require('./config/env');
const { runMigrations } = require('./config/migrate');
const { seedTestUsers } = require('./config/seed-test-users');
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
  // Semeadura opcional dos usuários de teste (fase de teste). Não derruba o boot se falhar.
  if (env.seedTestUsers) {
    try {
      const { usuarios } = await seedTestUsers();
      console.log(`Usuários de teste garantidos: ${usuarios.length}`);
    } catch (error) {
      console.error('Falha ao semear usuários de teste:', error.message);
    }
  }
  app.listen(env.port, () => {
    console.log(`API iniciada na porta ${env.port}`);
  });
  startJobs();
}

start();
