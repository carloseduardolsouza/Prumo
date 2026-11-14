import type { Category, CategoryType } from '@prisma/client';
import { prisma } from '../../../shared/database.js';

export const toPublicCategory = (c: Category) => ({
  id: c.id, name: c.name, type: c.type, icon: c.icon, color: c.color, parentId: c.parentId, archived: c.archivedAt !== null,
});

export const CategoryModel = {
  count: (userId: string) => prisma.category.count({ where: { userId } }),
  list: (userId: string, type?: CategoryType, archived = false) =>
    prisma.category.findMany({ where: { userId, ...(type ? { type } : {}), archivedAt: archived ? { not: null } : null }, orderBy: [{ parentId: 'asc' }, { name: 'asc' }] }),
  find: (userId: string, id: string) => prisma.category.findFirst({ where: { id, userId } }),
  findByName: (userId: string, type: CategoryType, name: string, parentId: string | null) =>
    prisma.category.findFirst({ where: { userId, type, parentId, name: { equals: name, mode: 'insensitive' }, archivedAt: null } }),
  create: (data: { userId: string; name: string; type: CategoryType; icon?: string | undefined; color?: string | undefined; parentId?: string | undefined }) =>
    prisma.category.create({ data: { ...data, icon: data.icon ?? null, color: data.color ?? null, parentId: data.parentId ?? null } }),
  update: (id: string, data: { name?: string | undefined; icon?: string | undefined; color?: string | undefined }) =>
    prisma.category.update({ where: { id }, data: { ...(data.name ? { name: data.name } : {}), ...(data.icon ? { icon: data.icon } : {}), ...(data.color ? { color: data.color } : {}) } }),
  archive: (id: string) => prisma.category.updateMany({ where: { OR: [{ id }, { parentId: id }] }, data: { archivedAt: new Date() } }),
};
