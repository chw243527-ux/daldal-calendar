import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { protectedProcedure } from "./_core/trpc";
import { createFamilyForUser, createLocalUser, getAccountCloudData, getFamilyBackups, getFamilyForUser, getUserByEmail, joinFamilyForUser, restoreFamilyBackup, saveAccountCloudData, saveFamilyLedger } from "./db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sdk } from "./_core/sdk";

const passwordHash = (password: string) => {
  const salt = randomBytes(16);
  return `${salt.toString("base64")}:${scryptSync(password, salt, 64).toString("base64")}`;
};
const passwordMatches = (password: string, stored: string) => {
  try {
    const [saltText, hashText] = stored.split(":");
    if (!saltText || !hashText) return false;
    const expected = Buffer.from(hashText, "base64");
    const actual = scryptSync(password, Buffer.from(saltText, "base64"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
};
const localOpenId = (email: string) => `local_${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;
const publicUser = (user: NonNullable<Awaited<ReturnType<typeof getUserByEmail>>>) => ({ id: user.id, openId: user.openId, name: user.name, email: user.email, loginMethod: user.loginMethod, role: user.role });

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user ? publicUser(opts.ctx.user) : null),
    register: publicProcedure.input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(8).max(200), name: z.string().trim().min(1).max(80) })).mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase();
      if (await getUserByEmail(email)) throw new TRPCError({ code: "CONFLICT", message: "이미 가입된 이메일이에요." });
      const user = await createLocalUser(email, input.name, passwordHash(input.password), localOpenId(email));
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "계정을 만들지 못했어요." });
      const token = await sdk.createSessionToken(user.openId, { name: user.name ?? input.name });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return publicUser(user);
    }),
    login: publicProcedure.input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(200) })).mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email.toLowerCase());
      if (!user?.passwordHash || !passwordMatches(input.password, user.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "이메일 또는 비밀번호를 확인해 주세요." });
      const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "" });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return publicUser(user);
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  accountCloud: router({
    get: protectedProcedure.query(({ ctx }) => getAccountCloudData(ctx.user.id)),
    sync: protectedProcedure.input(z.object({ payloadJson: z.string().min(2).max(2_000_000), baseVersion: z.number().int().nonnegative() })).mutation(({ ctx, input }) => saveAccountCloudData(ctx.user.id, input.payloadJson, input.baseVersion)),
  }),

  family: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const space = await getFamilyForUser(ctx.user.id);
      if (!space) return null;
      let records: unknown[] = [];
      try { records = JSON.parse(space.ledgerJson) as unknown[]; } catch { records = []; }
      return { id: space.id, name: space.name, inviteCode: space.inviteCode, records, version: space.version, backups: await getFamilyBackups(ctx.user.id), updatedAt: space.updatedAt.toISOString() };
    }),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(80).optional() })).mutation(async ({ ctx, input }) => {
      const existing = await getFamilyForUser(ctx.user.id);
      const space = existing ?? await createFamilyForUser(ctx.user.id, input.name);
      return { id: space.id, name: space.name, inviteCode: space.inviteCode };
    }),
    join: protectedProcedure.input(z.object({ inviteCode: z.string().trim().min(4).max(12) })).mutation(async ({ ctx, input }) => {
      const space = await joinFamilyForUser(ctx.user.id, input.inviteCode);
      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "초대 코드를 찾을 수 없어요." });
      return { id: space.id, name: space.name, inviteCode: space.inviteCode };
    }),
    sync: protectedProcedure.input(z.object({ records: z.array(z.unknown()).max(5000), baseVersion: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const space = await saveFamilyLedger(ctx.user.id, input.records, input.baseVersion);
      if (!space) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "먼저 가족 공유 공간을 만들어 주세요." });
      return space;
    }),
    restore: protectedProcedure.input(z.object({ backupId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const space = await restoreFamilyBackup(ctx.user.id, input.backupId);
      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "백업을 찾을 수 없어요." });
      return { version: space.version };
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
