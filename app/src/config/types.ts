export interface Environment {
  production: boolean;
  /** URL base da API core, já com o prefixo de versão (ex.: http://host:3000/api/v1). */
  coreUrl: string;
  /** URL base do serviço de mensagens (ex.: http://host:3001/message/v1). */
  messageUrl: string;
}
