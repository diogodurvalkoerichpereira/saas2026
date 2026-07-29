const dotenv = require('dotenv');

dotenv.config();

const required = ['DATABASE_HOST', 'DATABASE_NAME', 'DATABASE_USER', 'JWT_SECRET'];

function assertEnvironment() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente ausentes: ${missing.join(', ')}`);
  }
}

module.exports = {
  assertEnvironment,
  env: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 3000),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    jwtSecret: process.env.JWT_SECRET,
    integrations: {
      asaasUrl: process.env.ASAAS_API_URL || 'https://api.asaas.com/v3',
      asaasKey: process.env.ASAAS_API_KEY,
      whatsappUrl: process.env.WHATSAPP_API_URL,
      whatsappToken: process.env.WHATSAPP_API_TOKEN,
      whatsappInstanceId: process.env.WHATSAPP_INSTANCE_ID
    },
    database: {
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT || 3306),
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD || ''
    }
  }
};
