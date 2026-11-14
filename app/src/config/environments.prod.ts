import type { Environment } from './types';

// Produção. TODO: troque pelo domínio real da API antes de publicar o app.
export const environment: Environment = {
  production: true,
  coreUrl: 'https://api.prumo.com.br/api/v1',
  messageUrl: 'https://api.prumo.com.br/message/v1',
};
