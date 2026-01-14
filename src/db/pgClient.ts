import { Pool } from "pg";

export function createPgPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}
