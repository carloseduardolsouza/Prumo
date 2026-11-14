// Helpers dos smoke tests: rodam contra os serviços já em execução (npm run dev).
export const CORE = process.env.CORE_URL ?? 'http://localhost:3000';
export const MESSAGE = process.env.MESSAGE_URL ?? 'http://localhost:3001';

let failures = 0;

export async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  OK     ${name}`);
  } catch (e) {
    failures++;
    console.log(`  FALHA  ${name}\n         ${(e as Error).message}`);
  }
}

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export async function http(base: string, path: string, init?: RequestInit & { token?: string }) {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (init?.token) headers.set('authorization', `Bearer ${init.token}`);
  const res = await fetch(base + path, { ...init, headers });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* corpo não-JSON */
  }
  return { status: res.status, body };
}

export function finish(): never {
  console.log(failures === 0 ? '\nTudo certo.' : `\n${failures} verificação(ões) falharam.`);
  process.exit(failures === 0 ? 0 : 1);
}
