import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Environment } from './types';

// Desenvolvimento. O app acessa a API pelo IP do computador que roda o Metro (o celular e o emulador não
// enxergam o "localhost" do PC). No navegador, usa o próprio host da página.
function devHost(): string {
  if (Platform.OS === 'web') return typeof location !== 'undefined' ? location.hostname : 'localhost';
  return Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
}

const host = devHost();

export const environment: Environment = {
  production: false,
  coreUrl: `http://${host}:3000/api/v1`,
  messageUrl: `http://${host}:3001/message/v1`,
};
