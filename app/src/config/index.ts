import { environment as dev } from './environments';
import { environment as prod } from './environments.prod';

// __DEV__ é true no `expo start` e false nos builds de release: escolhe o arquivo de ambiente.
export const environment = __DEV__ ? dev : prod;
export type { Environment } from './types';
