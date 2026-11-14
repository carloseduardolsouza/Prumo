import { conflict, notFound, unprocessable } from '../../../shared/errors.js';
import { CategoryModel, toPublicCategory } from '../models/category.model.js';
import { AuditModel } from '../models/audit.model.js';

type Seed = { name: string; icon: string; color: string; sub?: string[] };

// Categorias padrão (RF034). O usuário pode criar, renomear e arquivar as dele.
const DEFAULT_EXPENSE: Seed[] = [
  { name: 'Moradia', icon: 'house', color: '#4C7DF0', sub: ['Aluguel', 'Condomínio', 'Energia', 'Água', 'Internet'] },
  { name: 'Alimentação', icon: 'food', color: '#F2B437', sub: ['Mercado', 'Restaurantes'] },
  { name: 'Transporte', icon: 'car', color: '#E5484D', sub: ['Combustível', 'Aplicativo de transporte'] },
  { name: 'Lazer', icon: 'play', color: '#6FD39B', sub: ['Streaming', 'Viagens'] },
  { name: 'Saúde', icon: 'heart', color: '#A78BFA', sub: ['Plano de saúde', 'Farmácia'] },
  { name: 'Educação', icon: 'school', color: '#46D9C8' },
  { name: 'Vestuário', icon: 'bag', color: '#FF8A4C' },
  { name: 'Outros', icon: 'dots', color: '#8A9099' },
];
const DEFAULT_INCOME: Seed[] = [
  { name: 'Salário', icon: 'job', color: '#6FD39B' },
  { name: 'Freelance', icon: 'code', color: '#4C7DF0' },
  { name: 'Rendimentos', icon: 'up', color: '#F2B437' },
  { name: 'Aluguel recebido', icon: 'house', color: '#46D9C8' },
  { name: 'Outros', icon: 'dots', color: '#8A9099' },
];

export const CategoryService = {
  /** Cria as categorias padrão na primeira vez que o usuário precisa delas (idempotente). */
  async ensureDefaults(userId: string) {
    if ((await CategoryModel.count(userId)) > 0) return;
    for (const [type, seeds] of [['EXPENSE', DEFAULT_EXPENSE], ['INCOME', DEFAULT_INCOME]] as const) {
      for (const s of seeds) {
        const parent = await CategoryModel.create({ userId, name: s.name, type, icon: s.icon, color: s.color });
        for (const sub of s.sub ?? []) await CategoryModel.create({ userId, name: sub, type, color: s.color, parentId: parent.id });
      }
    }
  },

  async list(userId: string, type?: 'INCOME' | 'EXPENSE', archived = false) {
    await this.ensureDefaults(userId);
    return (await CategoryModel.list(userId, type, archived)).map(toPublicCategory);
  },

  async create(userId: string, input: { name: string; type: 'INCOME' | 'EXPENSE'; icon?: string | undefined; color?: string | undefined; parentId?: string | undefined }) {
    await this.ensureDefaults(userId);
    if (input.parentId) {
      const parent = await CategoryModel.find(userId, input.parentId);
      if (!parent || parent.archivedAt) throw notFound('Categoria pai');
      if (parent.parentId) throw unprocessable('Subcategorias não podem ter subcategorias');
      if (parent.type !== input.type) throw unprocessable('A subcategoria precisa ser do mesmo tipo da categoria pai');
    }
    if (await CategoryModel.findByName(userId, input.type, input.name, input.parentId ?? null)) throw conflict('Já existe uma categoria com esse nome');
    const c = await CategoryModel.create({ userId, ...input });
    await AuditModel.record({ userId, action: 'category.create', entity: 'category', entityId: c.id, after: { name: c.name, type: c.type } });
    return toPublicCategory(c);
  },

  async update(userId: string, id: string, patch: { name?: string | undefined; icon?: string | undefined; color?: string | undefined }) {
    const c = await CategoryModel.find(userId, id);
    if (!c) throw notFound('Categoria');
    if (patch.name && (await CategoryModel.findByName(userId, c.type, patch.name, c.parentId))?.id !== undefined && (await CategoryModel.findByName(userId, c.type, patch.name, c.parentId))?.id !== id) throw conflict('Já existe uma categoria com esse nome');
    const updated = await CategoryModel.update(id, patch);
    await AuditModel.record({ userId, action: 'category.update', entity: 'category', entityId: id, before: { name: c.name }, after: { name: updated.name } });
    return toPublicCategory(updated);
  },

  /** Arquiva (e às subcategorias) em vez de apagar: os lançamentos antigos mantêm a categoria (RN008). */
  async archive(userId: string, id: string) {
    const c = await CategoryModel.find(userId, id);
    if (!c) throw notFound('Categoria');
    await CategoryModel.archive(id);
    await AuditModel.record({ userId, action: 'category.archive', entity: 'category', entityId: id });
  },
};
