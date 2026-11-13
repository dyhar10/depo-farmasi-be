export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  REFRESH_TOKEN_TTL_DAYS: number;
  COOKIE_DOMAIN: string;
  CORS_ORIGIN: string;
  LOG_LEVEL: string;
  SENTRY_DSN?: string;
  APP_DOMAIN: string;
}

export function validateEnv(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.PORT || '3000', 10);
  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/depo_dev';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || 'dev-jwt-access-secret-minimum-32-chars-long';
  const jwtAccessTtlSeconds = parseInt(process.env.JWT_ACCESS_TTL_SECONDS || '900', 10);
  const refreshTokenTtlDays = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '14', 10);
  const cookieDomain = process.env.COOKIE_DOMAIN || 'localhost';
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const logLevel = process.env.LOG_LEVEL || 'info';
  const sentryDsn = process.env.SENTRY_DSN;
  const appDomain = process.env.APP_DOMAIN || 'localhost';

  if (!databaseUrl && nodeEnv !== 'test') {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl || 'postgres://postgres:postgres@localhost:5432/depo_dev',
    REDIS_URL: redisUrl,
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_ACCESS_TTL_SECONDS: jwtAccessTtlSeconds,
    REFRESH_TOKEN_TTL_DAYS: refreshTokenTtlDays,
    COOKIE_DOMAIN: cookieDomain,
    CORS_ORIGIN: corsOrigin,
    LOG_LEVEL: logLevel,
    SENTRY_DSN: sentryDsn,
    APP_DOMAIN: appDomain,
  };
}