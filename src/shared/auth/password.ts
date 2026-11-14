import argon2 from 'argon2';

export const MIN_PASSWORD_LENGTH = 8;

// Argon2id (RNF002), parâmetros padrão do pacote (memória 64 MiB, 3 iterações).
export const hashPassword = (plain: string): Promise<string> => argon2.hash(plain, { type: argon2.argon2id });

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
