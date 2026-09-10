import { z } from "zod";
import { fetchBeds } from "../../lib/api/beds";
import { fetchBillingRecords } from "../../lib/api/billing";
import {
  fetchIssues,
  submitIssue,
  updateIssueStatus,
} from "../../lib/api/issues";
import {
  ensureLandlordInbox,
  fetchLandlordNotifications,
  markAllLandlordNotificationsReadRemote,
  markLandlordNotificationReadRemote,
} from "../../lib/api/landlordNotifications";
import {
  ensureRentDueNotification,
  fetchStudentNotifications,
  markStudentNotificationRead,
} from "../../lib/api/notifications";
import {
  findTenantByEmail,
  findTenantOnBed,
  reconcileAllOccupancy,
  reconcileBedSpace,
} from "../../lib/api/occupancy";
import { saveOccupancyAdmin } from "../../lib/api/occupancyAdmin";
import type { OccupancyAdminEditInput } from "../../lib/occupancyBillingEdit";
import {
  fetchPayments,
  recordManualPayment,
  rejectPayment,
  submitPayment,
  updatePayment,
  verifyPayment,
} from "../../lib/api/payments";
import { updateLandlordProfile } from "../../lib/api/profiles";
import { applyRentIncrement } from "../../lib/api/rent";
import { persistFinancialSnapshot } from "../../lib/api/snapshots";
import {
  evictTenant,
  fetchStudentAccounts,
  updateStudentAccount,
} from "../../lib/api/students";
import {
  completeStudentOnboarding,
  listVacantBedsForOnboarding,
  onboardStudent,
  updateStudent,
  vacateBedSpace,
} from "../../lib/api/tenants";
import {
  fetchUtilities,
  toggleUtilitySettled,
  upsertUtility,
} from "../../lib/api/utilities";
import { BILLING_MONTHS } from "../../lib/billing";
import { PAYMENT_METHODS, type BlockCode } from "../../lib/types";
import { dbFn } from "../dbFn";
import { authedProcedure, landlordProcedure, publicProcedure, router } from "../trpc";

const paymentMethod = z.enum(PAYMENT_METHODS);
const roomGender = z.enum(["Male", "Female"]);
const issueStatus = z.enum(["open", "in_progress", "resolved"]);
const issueCategory = z.enum(["Plumbing", "Electrical", "Structural", "Appliance"]);
const billingMonth = z.enum(BILLING_MONTHS as unknown as [string, ...string[]]);
const rentMode = z.enum(["percentage", "fixed"]);
const tenantStatus = z.enum(["evicted", "moved_out"]);

export const authRouter = router({
  tenantExists: publicProcedure
    .input(z.object({ email: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!ctx.supabase) return false;
      const { data, error } = await dbFn<boolean>(ctx.supabase, "tenant_exists_for_email", {
        p_email: input.email.trim().toLowerCase(),
      });
      if (!error) return data === true;
      const tenant = await findTenantByEmail(input.email);
      return Boolean(tenant);
    }),

  linkLandlordProfile: authedProcedure.query(async ({ ctx }) => {
    const { data, error } = await dbFn<Array<{
      profile_id: string;
      role: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
      bio: string | null;
    }>>(ctx.supabase, "link_landlord_profile");
    if (!error) {
      const row = data?.[0];
      return row ? { ...row, id: row.profile_id } : null;
    }
    const email = (await ctx.supabase.auth.getUser()).data.user?.email;
    if (!email) return null;
    const { data: fallback, error: fallbackError } = await ctx.supabase
      .from("profiles")
      .select("id, role, full_name, email, phone, address, bio")
      .eq("role", "landlord")
      .ilike("email", email)
      .maybeSingle();
    if (fallbackError) throw fallbackError;
    return fallback;
  }),

  isAdmin: authedProcedure.query(async ({ ctx }) => ctx.isAdmin),
  currentLandlordId: publicProcedure.query(({ ctx }) => ctx.landlordId),
  currentTenantId: publicProcedure.query(({ ctx }) => ctx.tenantId),
});

const occupancyBillingStatus = z.enum(["Open Window", "Paid / Secured", "OVERDUE / UNPAID", "Grace Period"]);

export const occupancyRouter = router({
  reconcileAll: landlordProcedure.mutation(() => reconcileAllOccupancy()),
  reconcileBed: landlordProcedure
    .input(z.object({ bedId: z.string() }))
    .mutation(({ input }) => reconcileBedSpace(input.bedId)),
  findOnBed: authedProcedure
    .input(z.object({ bedId: z.string() }))
    .query(({ input }) => findTenantOnBed(input.bedId)),
  findByEmail: authedProcedure
    .input(z.object({ email: z.string() }))
    .query(({ input }) => findTenantByEmail(input.email)),
  saveAdmin: landlordProcedure
    .input(z.object({
      tenantId: z.string(),
      name: z.string(),
      phone: z.string(),
      email: z.string(),
      moveInDate: z.string(),
      gender: roomGender.optional(),
      bedId: z.string(),
      rentAmount: z.number(),
      billingStatus: occupancyBillingStatus,
      targetMonth: billingMonth,
      monthsCovered: z.number().int().min(1).max(12),
      totalBalance: z.number().optional(),
      paymentDate: z.string(),
      paymentAmount: z.number(),
      paymentMethod,
      paymentRef: z.string().optional(),
    }))
    .mutation(({ input }) => saveOccupancyAdmin(input as OccupancyAdminEditInput)),
});

export const bedsRouter = router({
  list: authedProcedure.query(() => fetchBeds()),
});

export const billingRouter = router({
  list: authedProcedure.query(() => fetchBillingRecords()),
});

export const paymentsRouter = router({
  list: authedProcedure.query(() => fetchPayments()),
  submit: authedProcedure
    .input(z.object({
      studentName: z.string(),
      bedSpaceId: z.string(),
      amount: z.number(),
      method: paymentMethod,
      transactionRef: z.string(),
      proofUrl: z.string().optional(),
    }))
    .mutation(({ input }) => submitPayment(input)),
  verify: landlordProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => verifyPayment(input.id)),
  reject: landlordProcedure
    .input(z.object({ id: z.string(), reason: z.string() }))
    .mutation(({ input }) => rejectPayment(input.id, input.reason)),
  update: landlordProcedure
    .input(z.object({
      id: z.string(),
      studentName: z.string(),
      bedSpaceId: z.string(),
      amount: z.number(),
      method: paymentMethod,
      transactionRef: z.string(),
      submittedAt: z.string(),
    }))
    .mutation(({ input }) => updatePayment(input)),
  recordManual: landlordProcedure
    .input(z.object({
      bedSpaceId: z.string(),
      studentName: z.string(),
      amount: z.number(),
      method: paymentMethod,
      transactionRef: z.string().optional(),
      submittedAt: z.string(),
    }))
    .mutation(({ input }) => recordManualPayment(input)),
});

export const tenantsRouter = router({
  onboard: landlordProcedure
    .input(z.object({
      bedId: z.string(),
      name: z.string(),
      phone: z.string(),
      email: z.string(),
      moveInDate: z.string(),
      nrc: z.string().optional(),
      rentAmount: z.number().optional(),
      gender: roomGender.optional(),
    }))
    .mutation(({ input }) => onboardStudent(input)),
  update: landlordProcedure
    .input(z.object({
      tenantId: z.string(),
      name: z.string(),
      phone: z.string(),
      email: z.string(),
      nrc: z.string().optional(),
      moveInDate: z.string(),
      gender: roomGender.optional(),
      sendLoginLink: z.boolean().optional(),
    }))
    .mutation(({ input }) => updateStudent(input)),
  vacate: landlordProcedure
    .input(z.object({ bedId: z.string() }))
    .mutation(({ input }) => vacateBedSpace(input.bedId)),
  vacantForOnboarding: authedProcedure
    .input(z.object({ gender: roomGender }))
    .query(({ input }) => listVacantBedsForOnboarding(input.gender)),
  completeOnboarding: authedProcedure
    .input(z.object({
      gender: roomGender,
      bedId: z.string(),
      name: z.string(),
      phone: z.string(),
      nrc: z.string().optional(),
      moveInDate: z.string(),
    }))
    .mutation(({ input }) => completeStudentOnboarding(input)),
});

export const studentsRouter = router({
  list: landlordProcedure
    .input(z.object({ includeInactive: z.boolean().optional() }).optional())
    .query(({ input }) => fetchStudentAccounts({ includeInactive: input?.includeInactive ?? false })),
  evict: landlordProcedure
    .input(z.object({
      tenantId: z.string(),
      reason: z.string(),
      actor: z.string().nullable().optional(),
      status: tenantStatus.optional(),
    }))
    .mutation(({ input }) => evictTenant(input)),
  updateAccount: landlordProcedure
    .input(z.object({
      tenantId: z.string(),
      name: z.string(),
      phone: z.string(),
      email: z.string(),
      nrc: z.string().optional(),
      moveInDate: z.string(),
      bedSpaceId: z.string(),
      rentAmount: z.number(),
      gender: roomGender.optional(),
      billingStatus: occupancyBillingStatus.optional(),
      manualPayment: z.object({
        amount: z.number(),
        submittedAt: z.string(),
        method: paymentMethod,
        transactionRef: z.string().optional(),
      }).optional(),
    }))
    .mutation(({ input }) => updateStudentAccount(input)),
});

export const issuesRouter = router({
  list: authedProcedure.query(() => fetchIssues()),
  submit: authedProcedure
    .input(z.object({
      bedSpaceId: z.string(),
      studentName: z.string(),
      category: issueCategory,
      description: z.string(),
      imageUrl: z.string().optional(),
    }))
    .mutation(({ input }) => submitIssue(input)),
  updateStatus: landlordProcedure
    .input(z.object({
      id: z.string(),
      status: issueStatus,
      resolutionNote: z.string().optional(),
    }))
    .mutation(({ input }) => updateIssueStatus(input.id, input.status, input.resolutionNote)),
});

export const notificationsRouter = router({
  list: authedProcedure.query(() => fetchStudentNotifications()),
  markRead: authedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => markStudentNotificationRead(input.id)),
  ensureRentDue: authedProcedure.mutation(() => ensureRentDueNotification()),
});

export const landlordInboxRouter = router({
  list: landlordProcedure.query(() => fetchLandlordNotifications()),
  markRead: landlordProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => markLandlordNotificationReadRemote(input.id)),
  markAllRead: landlordProcedure.mutation(() => markAllLandlordNotificationsReadRemote()),
  ensure: landlordProcedure.mutation(() => ensureLandlordInbox()),
});

export const utilitiesRouter = router({
  list: authedProcedure.query(() => fetchUtilities()),
  upsert: landlordProcedure
    .input(z.object({
      id: z.string().optional(),
      blockCode: z.string(),
      month: z.string(),
      totalCost: z.number(),
      activeStudents: z.number(),
      ownerContribution: z.number(),
      excess: z.number(),
      studentsSettled: z.array(z.string()),
    }))
    .mutation(({ input }) => upsertUtility({ ...input, blockCode: input.blockCode as BlockCode })),
  toggleSettled: landlordProcedure
    .input(z.object({
      blockCode: z.string(),
      month: z.string(),
      studentName: z.string(),
    }))
    .mutation(({ input }) => toggleUtilitySettled(input.blockCode as BlockCode, input.month, input.studentName)),
});

export const profilesRouter = router({
  updateLandlord: landlordProcedure
    .input(z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      phone: z.string(),
      address: z.string(),
      bio: z.string(),
    }))
    .mutation(({ input }) => updateLandlordProfile(input)),
});

export const snapshotsRouter = router({
  persist: landlordProcedure
    .input(z.object({
      month: billingMonth,
      year: z.number(),
      report: z.any(),
      actor: z.string().nullable().optional(),
    }))
    .mutation(({ input }) => persistFinancialSnapshot({
      month: input.month as (typeof BILLING_MONTHS)[number],
      year: input.year,
      report: input.report,
      actor: input.actor,
    })),
});

export const rentRouter = router({
  applyIncrement: landlordProcedure
    .input(z.object({
      bedIds: z.array(z.string()),
      mode: rentMode,
      value: z.number(),
      effectiveDate: z.string(),
      actor: z.string().nullable().optional(),
    }))
    .mutation(({ input }) => applyRentIncrement(input)),
});
