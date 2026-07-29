const { app } = require('./app');
const { assertEnvironment, env } = require('./config/env');

assertEnvironment();

app.listen(env.port, () => {
  console.log(`API iniciada na porta ${env.port}`);
});
