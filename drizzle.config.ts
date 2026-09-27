import { defineConfig } from "drizzle-kit";
import { config } from 'dotenv';

// Production also reads .env; both cases end with .env.local (dotenv never overrides set vars)
if (process.env.NODE_ENV === 'production') {
    config({ path: '.env' })
}
config({ path: '.env.local' })

// Fail fast with a clear message instead of drizzle-kit's silent exit 1
if (!process.env.DATABASE_URL) {
    throw new Error(
        'DATABASE_URL is not set. On Vercel, add it in Project Settings > Environment Variables ' +
            '(must be enabled for Builds); locally, put it in .env.local.'
    );
}

export default defineConfig({
    schema: "./utils/db/schema.ts",
    out: "./utils/db/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});