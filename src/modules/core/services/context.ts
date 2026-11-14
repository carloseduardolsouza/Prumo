import { prisma } from '../../../shared/database.js';
import { todayIn } from '../../../shared/dates.js';
import { notFound, unprocessable } from '../../../shared/errors.js';
import { toDate } from '../models/finance.schemas.js';
import { WalletModel } from '../models/wallet.model.js';

/** "Hoje" no fuso configurado pelo usuário. */
export async function todayOf(userId: string): Promise<string> {
  const p = await prisma.userPreference.findUnique({ where: { userId }, select: { timezone: true } });
  return todayIn(p?.timezone ?? 'America/Sao_Paulo');
}

export const dateOrToday = async (userId: string, d?: string) => toDate(d ?? (await todayOf(userId)));

/** Carteira do usuário, ativa (RN019: arquivada não recebe lançamentos comuns). */
export async function activeWallet(userId: string, id: string) {
  const w = await WalletModel.find(userId, id);
  if (!w) throw notFound('Carteira');
  if (w.archivedAt) throw unprocessable('Carteira arquivada: reative-a para novos lançamentos');
  return w;
}
