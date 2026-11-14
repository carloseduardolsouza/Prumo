import { Share } from 'react-native';
import { plannerApi } from '@/api/finance';

/** Baixa o CSV do período e abre a folha de compartilhamento do sistema (salvar, e-mail, planilha). */
export async function shareCsv(kind: 'transactions' | 'investments', range: { from: string; to: string }): Promise<void> {
  const text = await plannerApi.exportCsv(kind, range.from, range.to);
  await Share.share({ title: `prumo-${kind}-${range.from}`, message: text });
}
