import { defineConfig } from "drizzle-kit";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  // drizzle-kit is only ever invoked from the repo root after loading
  // .env.local (see scripts in this package's package.json). A missing
  // URL here is always a setup bug, not a runtime bug.
  throw new Error("DATABASE_URL not set when loading drizzle.config.ts");
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
  // Strict + verbose for day-2 sanity; we'll dial back verbose once the
  // pipeline settles.
  strict: true,
  verbose: false,
});
