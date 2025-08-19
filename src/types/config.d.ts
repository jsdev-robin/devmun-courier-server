export interface ProcessEnv {
  // Server
  NODE_ENV: 'development' | 'production';
  PORT: number;
  GATEWAY_PORT: number;
  AUTH_PORT: number;
  PRODUCT_PORT: number;

  // Database
  DATABASE_ONLINE: string;
  DATABASE_PASSWORD_ONLINE: string;
  NODE_REDIS_URL: string;
  NODE_REDIS_PORT: string;

  // Redis / Upstash
  REDIS_URL: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;

  // Secrets & Encryption
  ACTIVATION_SECRET: string;
  CRYPTO_SECRET: string;
  HMAC_SECRET: string;
  EMAIL_CHANGE_SECRET: string;
  ALGORITHM: string;
  KEY_LENGTH: number;
  IV_LENGTH: number;

  // Auth Tokens
  ACCESS_TOKEN: string;
  REFRESH_TOKEN: string;
  PROTECT_TOKEN: string;
  ACCESS_TOKEN_EXPIRE: string;
  REFRESH_TOKEN_EXPIRE: string;
  PROTECT_TOKEN_EXPIRE: string;

  // Email
  EMAIL_USERNAME: string;
  EMAIL_PASSWORD: string;
  EMAIL_HOST: string;
  EMAIL_PORT: number;
  EMAIL_FROM: string;

  // OAuth - Google
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  // OAuth - GitHub
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;

  // OAuth - Facebook
  FACEBOOK_CLIENT_ID: string;
  FACEBOOK_CLIENT_SECRET: string;

  // OAuth - X
  CONSUMER_KEY: string;
  CONSUMER_SECRET: string;

  // OAuth - Discord
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;

  // Cloudinary
  CLOUD_NAME: string;
  CLOUD_API_KEY: string;
  CLOUD_API_SECRET: string;
  CLOUDINARY_URL: string;

  // IPInfo
  IPINFO_KEY: string;

  // Client url
  CLIENT_ORIGIN: string;
  CLIENT_HUB_ORIGIN: string;
  SERVER_HUB_ORIGIN: string;
  SHOP_ORIGIN: string;

  // Cookie secret
  COOKIE_SECRET: string;

  // Stripe key
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_SECRET_KEY: string;

  // Kafka
  KAFKA_BROKERS: string;
  KAFKA_USERNAME: string;
  KAFKA_PASSWORD: string;
}
