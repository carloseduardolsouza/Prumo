import { parseEnv, type Env } from './env-schema.js';

// Carrega o .env da raiz (Node 22+). Fica aqui, no topo, porque imports ESM são avaliados antes do corpo do server.ts.
try {
  process.loadEnvFile();
} catch {
  /* sem .env: valem as variáveis já presentes no ambiente (Docker, CI) */
}

export type { Env };
export const env: Env = parseEnv(process.env);
