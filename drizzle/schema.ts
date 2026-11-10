import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 256 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const familySpaces = mysqlTable("familySpaces", {
  id: int("id").autoincrement().primaryKey(),
  inviteCode: varchar("inviteCode", { length: 12 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull().default("우리 가족 가계부"),
  ownerUserId: int("ownerUserId").notNull(),
  ledgerJson: text("ledgerJson").notNull(),
  updatedBy: int("updatedBy"),
  version: int("version").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const familyMembers = mysqlTable("familyMembers", {
  id: int("id").autoincrement().primaryKey(),
  spaceId: int("spaceId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "member"]).default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  spaceUserUnique: uniqueIndex("familyMembers_space_user_unique").on(table.spaceId, table.userId),
}));

export const familyBackups = mysqlTable("familyBackups", {
  id: int("id").autoincrement().primaryKey(),
  spaceId: int("spaceId").notNull(),
  version: int("version").notNull(),
  snapshotJson: text("snapshotJson").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const accountCloudData = mysqlTable("accountCloudData", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  payloadJson: text("payloadJson").notNull(),
  version: int("version").notNull().default(1),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userUnique: uniqueIndex("accountCloudData_user_unique").on(table.userId),
}));

export type FamilySpace = typeof familySpaces.$inferSelect;
