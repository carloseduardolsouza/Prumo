import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/src/**/*.test.ts'],
    // Valores fictícios: os testes não dependem do .env nem de banco (Prisma é mockado).
    env: {
      NODE_ENV: 'test',
      DB_USER: 'test',
      DB_PASSWORD: 'test',
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
      INTERNAL_API_KEY: 'test-internal-key-0123456789',
    },
  },
});
