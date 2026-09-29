import { date, pgTable, text } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users_table', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  plan: text('plan').notNull(),
  stripe_id: text('stripe_id').notNull(),
  username: text('username').unique(),
  first_name: text('first_name'),
  last_name: text('last_name'),
  dob: date('dob'),
});

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;
