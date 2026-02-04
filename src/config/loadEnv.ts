import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

function loadEnvFile(fileName: string) {
  const filePath = resolve(process.cwd(), fileName);
  if (existsSync(filePath)) {
    config({ path: filePath });
  }
}

// Prefer local overrides first, then fallback to .env
loadEnvFile(".env.local");
loadEnvFile(".env");
