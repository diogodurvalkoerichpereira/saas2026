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
    marketing: {
      dispatchEnabled: process.env.WHATSAPP_DISPATCH_ENABLED === 'true',
      batchSize: Math.min(Math.max(Number(process.env.WHATSAPP_BATCH_SIZE || 20), 1), 100),
      maxAttempts: Math.min(Math.max(Number(process.env.WHATSAPP_MAX_ATTEMPTS || 3), 1), 10),
      retryMinutes: Math.min(Math.max(Number(process.env.WHATSAPP_RETRY_MINUTES || 15), 1), 1440)
    },
    jobs: {
      enabled: process.env.JOBS_ENABLED === 'true',
      intervalMinutes: Math.min(Math.max(Number(process.env.JOBS_INTERVAL_MINUTES || 5), 1), 1440)
    },
    database: {
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT || 5432),
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD || ''
    }
  }
};
