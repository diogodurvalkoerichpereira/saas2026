const { app } = require('./app');
const { assertEnvironment, env } = require('./config/env');
const { startJobs } = require('./jobs');

assertEnvironment();

app.listen(env.port, () => {
  console.log(`API iniciada na porta ${env.port}`);
});

startJobs();
