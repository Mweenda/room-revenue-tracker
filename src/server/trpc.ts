import { initTRPC, TRPCError } from "@trpc/server";
import type { AppContext } from "./context";

// This Vite app calls procedures in-process via createCaller (no HTTP tRPC
// server). tRPC v11 throws in the browser unless this is set.
const t = initTRPC.context<AppContext>().create({
  allowOutsideOfServer: true,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const authedProcedure = t.procedure.use(async function isAuthed(opts) {
  if (!opts.ctx.supabase) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in is required" });
  }
  return opts.next({ ctx: { ...opts.ctx, supabase: opts.ctx.supabase } });
});

export const landlordProcedure = t.procedure.use(async function isLandlord(opts) {
  if (!opts.ctx.landlordId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Landlord access is required",
    });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      landlordId: opts.ctx.landlordId,
    },
  });
});

export const studentProcedure = t.procedure.use(async function isStudent(opts) {
  if (!opts.ctx.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Student access is required",
    });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      tenantId: opts.ctx.tenantId,
    },
  });
});

export const adminProcedure = t.procedure.use(async function isAdmin(opts) {
  if (!opts.ctx.isAdmin) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Admin access is required",
    });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      isAdmin: true,
    },
  });
});
