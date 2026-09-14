import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', {
  id: text('id').primaryKey(), owner: text('owner').notNull(),
  name: text('name').notNull().default(''), title: text('title').notNull().default(''),
  zone: text('zone').notNull(), section: text('section').notNull(),
  birth: text('birth').notNull().default(''), city: text('city').notNull().default(''),
  uf: text('uf').notNull().default(''), address: text('address').notNull().default(''),
  cpf: text('cpf').notNull().default(''), phone: text('phone').notNull().default(''),
  place: text('place').notNull().default(''), revision: integer('revision').notNull().default(1),
  updated: text('updated').notNull(),
}, (t) => [index('idx_records_owner').on(t.owner)]);
