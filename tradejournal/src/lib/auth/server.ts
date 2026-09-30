import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Pool } from "pg";

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value || undefined;
};

const databaseUrl = env("DATABASE_URL");
const googleId = env("GOOGLE_CLIENT_ID");
const googleSecret = env("GOOGLE_CLIENT_SECRET");

// Жестко привязываем к вашему домену продакшна
const appUrl = "https://vercel.app";

export const authConfigured = Boolean(databaseUrl && env("BETTER_AUTH_SECRET"));

const extraOrigins = (env("BETTER_AUTH_TRUSTED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const database = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }, // Отключаем проверку SSL для бэкенда
      max: /[?&]pgbouncer=true|:6543\b/i.test(databaseUrl) ? 1 : 8,
    })
  : undefined;

export const auth = betterAuth({
  baseURL: appUrl,
  secret: env("BETTER_AUTH_SECRET") ?? "change-me-in-production",
  ...(database ? { database } : {}),
  trustedOrigins: [...(appUrl ? [appUrl] : []), ...extraOrigins],
  emailAndPassword: { enabled: true },
  ...(googleId && googleSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleId,
            clientSecret: googleSecret,
          },
        },
      }
    : {}),
  plugins: [tanstackStartCookies()],
});
