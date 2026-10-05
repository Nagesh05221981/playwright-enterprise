import {getLogger} from '../logging/index.js'
const envConfig = {
    dev: {
        baseURL: "http://localhost:8501",
        apiURL: "http://localhost:8501/api",
        name: 'Development'
    },
    staging: {
        baseURL: "https://staging.yourapp.com",
        apiURL: "https://staging.yourapp.com/api",
        name: "Staging"
    },
    prod: {
        baseURL: "https://yourapp.com",
        apiURL: "https://yourapp.com/api",
        name: "Production"
    }
}

export function getEnvConfig() {
  const logger = getLogger();
  const env = process.env.TEST_ENV || 'dev';
  if (!envConfig[env]) {
    const msg = `Unknown environment: "${env}". Valid values: ${Object.keys(envConfig).join(', ')}`;
    logger.error(msg);
    throw new Error(msg);
  }
  logger.info(`Environment resolved: ${envConfig[env].name} (${envConfig[env].baseURL})`);
  return envConfig[env];
}