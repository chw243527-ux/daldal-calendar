import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { protectedProcedure } from "./_core/trpc";
import { createFamilyForUser, getAccountCloudData, getFamilyBackups, getFamilyForUser, joinFamilyForUser, restoreFamilyBackup, saveAccountCloudData, saveFamilyLedger } from "./db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
