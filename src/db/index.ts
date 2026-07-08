import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let dbInstance: any = null;

export const isCloudSqlAvailable = (): boolean => {
  return !!(
    process.env.SQL_HOST &&
    process.env.SQL_USER &&
    process.env.SQL_PASSWORD &&
    process.env.SQL_DB_NAME
  );
};

// Function to create or get the connection pool
export const getPool = (): pg.Pool => {
  if (!isCloudSqlAvailable()) {
    throw new Error("Google Cloud SQL configuration is missing in environment variables.");
  }
  if (!pool) {
    pool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      connectionTimeoutMillis: 15000,
    });

    pool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return pool;
};

// Initialize or get Drizzle instance
export const getDb = () => {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
};

// Export db as a proxy or getter compatibility layer if accessed directly
export const db = new Proxy({} as any, {
  get(target, prop) {
    return getDb()[prop];
  }
});

