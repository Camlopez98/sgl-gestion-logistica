import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Los archivos comparten la base de pruebas: se ejecutan uno tras otro.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      BCRYPT_COSTO: '4',
    },
  },
});
