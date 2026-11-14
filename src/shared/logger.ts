type Level = 'debug' | 'info' | 'warn' | 'error';

// Nunca passe senhas, tokens ou dados de cartão para o logger (RNF008).
function write(level: Level, service: string, message: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, service, message, ...meta });
  (level === 'error' ? console.error : console.log)(line);
}

export function createLogger(service: string) {
  return {
    debug: (m: string, meta?: Record<string, unknown>) => write('debug', service, m, meta),
    info: (m: string, meta?: Record<string, unknown>) => write('info', service, m, meta),
    warn: (m: string, meta?: Record<string, unknown>) => write('warn', service, m, meta),
    error: (m: string, meta?: Record<string, unknown>) => write('error', service, m, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
