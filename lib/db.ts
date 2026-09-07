import { Pool, types } from "pg";

// pg's default DATE (oid 1082) parser builds a JS Date at local-timezone
// midnight, which then serializes to a shifted UTC instant (e.g.
// "1998-11-20" -> "1998-11-20T07:00:00.000Z") instead of the plain date.
// Keep it as the raw "YYYY-MM-DD" string CelesTrak/SATCAT gave us.
types.setTypeParser(1082, (val) => val);

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. Copy .env.local.example to .env.local and fill it in.");
    }
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}
