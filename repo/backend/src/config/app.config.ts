export const appConfig = () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'meridianmed',
    user: process.env.DB_USER || 'meridian',
    password: process.env.DB_PASSWORD || 'meridian_secret',
  },
  jwt: {
    secret: process.env.JWT_SECRET, // Required — no fallback. Set in docker-compose.yml.
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '8h',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY, // Required — no fallback. Set in docker-compose.yml.
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '10', 10),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
});
