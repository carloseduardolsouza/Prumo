import '../shared/config/env.js';
import { prisma } from '../shared/database.js';

// E0: nada a semear. E3 acrescenta as categorias padrão (idempotente por upsert).
async function main() {
  console.log('seed: nenhum dado inicial nesta entrega');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
