import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/shared/config/env.js';
import { redis } from '../src/shared/redis.js';

// npm run bootstrap — prepara o ambiente local do zero e pode ser repetido sem efeitos colaterais:
//   1) gera o Prisma Client, 2) confere Redis, 3) cria o banco se não existir, 4) aplica migrations,
//   5) roda as seeds (upsert, idempotentes).
// O generate vem primeiro: depois que este processo carrega o engine do Prisma, o Windows trava a DLL e o generate falha (EPERM).

const step = (n: number, msg: string) => console.log(`\n[${n}/5] ${msg}`);

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: process.env });
  if (r.status !== 0) throw new Error(`falhou: ${cmd} ${args.join(' ')}`);
}

function urlFor(database: string): string {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_SCHEMA } = env;
  return `postgresql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${database}?schema=${DB_SCHEMA}`;
}

async function ensureDatabase() {
  if (!/^[A-Za-z0-9_-]+$/.test(env.DB_NAME)) throw new Error(`DB_NAME inválido: ${env.DB_NAME}`);
  // Conecta no banco de manutenção "postgres" só para criar o banco do Prumo.
  const admin = new PrismaClient({ datasources: { db: { url: urlFor('postgres') } } });
  try {
    const rows = await admin.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok FROM pg_database WHERE datname = ${env.DB_NAME}`;
    if (rows.length) return console.log(`      banco "${env.DB_NAME}" já existe`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${env.DB_NAME}"`);
    console.log(`      banco "${env.DB_NAME}" criado`);
  } finally {
    await admin.$disconnect();
  }
}

async function main() {
  step(1, 'Gerando o Prisma Client');
  try {
    run('npx', ['prisma', 'generate']);
  } catch (e) {
    // Com `npm run dev` aberto o Windows trava a DLL do engine (EPERM). Se o client já existe, seguimos.
    if (!existsSync('node_modules/.prisma/client/index.js')) throw e;
    console.warn('      aviso: não foi possível regenerar (feche o `npm run dev` e rode de novo se o schema mudou); usando o client existente');
  }

  step(2, `Conferindo Redis (${env.REDIS_HOST}:${env.REDIS_PORT})`);
  await redis.connect();
  console.log(`      redis: ${await redis.ping()}`);
  await redis.quit();

  step(3, `Garantindo que o banco existe (Postgres ${env.DB_HOST}:${env.DB_PORT})`);
  await ensureDatabase();

  step(4, 'Aplicando migrations (prisma migrate deploy)');
  run('npx', ['prisma', 'migrate', 'deploy']);

  step(5, 'Rodando seeds');
  run('npx', ['tsx', 'src/prisma/seed.ts']);

  console.log('\nAmbiente pronto. Suba os serviços com: npm run dev');
}

main().catch((e) => {
  console.error(`\nBootstrap falhou: ${e instanceof Error ? e.message : e}`);
  console.error('Confira DB_*/REDIS_* no .env e se o Postgres e o Redis estão no ar.');
  process.exit(1);
});

