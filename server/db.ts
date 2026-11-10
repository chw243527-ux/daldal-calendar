import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { accountCloudData, familyBackups, familyMembers, familySpaces, InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "passwordHash", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createLocalUser(email: string, name: string, passwordHash: string, openId: string) {
  await upsertUser({ openId, email, name, passwordHash, loginMethod: "email" });
  return getUserByOpenId(openId);
}

const newInviteCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export async function getFamilyForUser(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const membership = await db.select({ spaceId: familyMembers.spaceId }).from(familyMembers).where(eq(familyMembers.userId, userId)).limit(1);
  if (!membership[0]) return null;
  const space = await db.select().from(familySpaces).where(eq(familySpaces.id, membership[0].spaceId)).limit(1);
  return space[0] ?? null;
}

export async function createFamilyForUser(userId: number, name = "우리 가족 가계부") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  let inviteCode = newInviteCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await db.select({ id: familySpaces.id }).from(familySpaces).where(eq(familySpaces.inviteCode, inviteCode)).limit(1);
    if (!existing[0]) break;
    inviteCode = newInviteCode();
  }
  const inserted = await db.insert(familySpaces).values({ inviteCode, name, ownerUserId: userId, ledgerJson: "[]", updatedBy: userId, version: 1 });
  const spaceId = Number(inserted[0].insertId);
  await db.insert(familyMembers).values({ spaceId, userId, role: "owner" });
  return (await getFamilyForUser(userId))!;
}

export async function joinFamilyForUser(userId: number, inviteCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const space = await db.select().from(familySpaces).where(eq(familySpaces.inviteCode, inviteCode.trim().toUpperCase())).limit(1);
  if (!space[0]) return null;
  const current = await db.select({ id: familyMembers.id }).from(familyMembers).where(and(eq(familyMembers.spaceId, space[0].id), eq(familyMembers.userId, userId))).limit(1);
  if (!current[0]) await db.insert(familyMembers).values({ spaceId: space[0].id, userId, role: "member" });
  return space[0];
}

export async function getFamilyBackups(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const family = await getFamilyForUser(userId);
  if (!family) return [];
  return db.select({ id: familyBackups.id, version: familyBackups.version, createdAt: familyBackups.createdAt }).from(familyBackups).where(eq(familyBackups.spaceId, family.id)).orderBy(desc(familyBackups.createdAt)).limit(10);
}

export async function saveFamilyLedger(userId: number, records: unknown[], baseVersion: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const family = await getFamilyForUser(userId);
  if (!family) return null;
  if (family.version !== baseVersion) {
    let remoteRecords: unknown[] = [];
    try { remoteRecords = JSON.parse(family.ledgerJson) as unknown[]; } catch { remoteRecords = []; }
    return { conflict: true as const, version: family.version, records: remoteRecords };
  }
  await db.insert(familyBackups).values({ spaceId: family.id, version: family.version, snapshotJson: family.ledgerJson, createdBy: userId });
  await db.update(familySpaces).set({ ledgerJson: JSON.stringify(records), updatedBy: userId, version: family.version + 1 }).where(and(eq(familySpaces.id, family.id), eq(familySpaces.version, baseVersion)));
  return { conflict: false as const, version: family.version + 1 };
}

export async function restoreFamilyBackup(userId: number, backupId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const family = await getFamilyForUser(userId);
  if (!family) return null;
  const backup = await db.select().from(familyBackups).where(and(eq(familyBackups.id, backupId), eq(familyBackups.spaceId, family.id))).limit(1);
  if (!backup[0]) return null;
  await db.insert(familyBackups).values({ spaceId: family.id, version: family.version, snapshotJson: family.ledgerJson, createdBy: userId });
  await db.update(familySpaces).set({ ledgerJson: backup[0].snapshotJson, updatedBy: userId, version: family.version + 1 }).where(eq(familySpaces.id, family.id));
  return getFamilyForUser(userId);
}

export async function getAccountCloudData(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(accountCloudData).where(eq(accountCloudData.userId, userId)).limit(1);
  if (!result[0]) return null;
  return { payloadJson: result[0].payloadJson, version: result[0].version, updatedAt: result[0].updatedAt.toISOString() };
}

export async function saveAccountCloudData(userId: number, payloadJson: string, baseVersion: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(accountCloudData).where(eq(accountCloudData.userId, userId)).limit(1);
  if (!existing[0]) {
    if (baseVersion !== 0) return { conflict: true as const, payloadJson: "{}", version: 0, updatedAt: new Date().toISOString() };
    await db.insert(accountCloudData).values({ userId, payloadJson, version: 1 });
    return { conflict: false as const, ...(await getAccountCloudData(userId))! };
  }
  if (existing[0].version !== baseVersion) {
    return { conflict: true as const, payloadJson: existing[0].payloadJson, version: existing[0].version, updatedAt: existing[0].updatedAt.toISOString() };
  }
  await db.update(accountCloudData).set({ payloadJson, version: baseVersion + 1 }).where(and(eq(accountCloudData.userId, userId), eq(accountCloudData.version, baseVersion)));
  const saved = await getAccountCloudData(userId);
  return saved ? { conflict: false as const, ...saved } : { conflict: false as const, payloadJson, version: baseVersion + 1, updatedAt: new Date().toISOString() };
}
