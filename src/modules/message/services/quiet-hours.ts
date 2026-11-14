export interface QuietConfig {
  quietEnabled: boolean;
  quietStart: number; // hora local 0-23
  quietEnd: number;
}

/** Hora (0-23) em `timeZone` para o instante `now`. */
export function localHour(now: Date, timeZone: string): number {
  try {
    const h = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(now);
    return Number(h);
  } catch {
    return now.getUTCHours();
  }
}

/** True se `now` cai no horário silencioso do usuário. A janela pode cruzar a meia-noite (ex.: 22h–7h). */
export function isQuietHour(now: Date, timeZone: string, cfg: QuietConfig): boolean {
  if (!cfg.quietEnabled || cfg.quietStart === cfg.quietEnd) return false;
  const h = localHour(now, timeZone);
  return cfg.quietStart < cfg.quietEnd ? h >= cfg.quietStart && h < cfg.quietEnd : h >= cfg.quietStart || h < cfg.quietEnd;
}
