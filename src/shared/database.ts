import { PrismaClient } from '@prisma/client';
import { env } from './config/env.js';

// A URL é montada a partir de DB_* (mesma origem do DATABASE_URL do .env, usado só pelo Prisma CLI).
export function buildDatabaseUrl(): string {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME, DB_SCHEMA } = env;
  return `postgresql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=${DB_SCHEMA}`;
}

export const prisma = new PrismaClient({ datasources: { db: { url: buildDatabaseUrl() } } });
