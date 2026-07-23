import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Database client using Neon's serverless HTTP driver.
 *
 * Connection string is read from `DATABASE_URL` at call time. If not set,
 * `getDb()` returns null so the app can run without a database (session
 * history just won't persist).
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "" || url === "your_neon_database_url_here") {
    return null;
  }

  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

export { schema };
