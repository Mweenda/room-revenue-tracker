import { spreadsheetRouter } from "./routers/spreadsheet";
import {
  applicationsRouter,
  authRouter,
  bedsRouter,
  billingRouter,
  issuesRouter,
  landlordInboxRouter,
  notificationsRouter,
  occupancyRouter,
  paymentsRouter,
  profilesRouter,
  rentRouter,
  snapshotsRouter,
  studentsRouter,
  tenantsRouter,
  utilitiesRouter,
} from "./routers/tracker";
import { createCallerFactory, router } from "./trpc";

export const appRouter = router({
  auth: authRouter,
  occupancy: occupancyRouter,
  beds: bedsRouter,
  billing: billingRouter,
  payments: paymentsRouter,
  tenants: tenantsRouter,
  students: studentsRouter,
  issues: issuesRouter,
  notifications: notificationsRouter,
  landlordInbox: landlordInboxRouter,
  utilities: utilitiesRouter,
  profiles: profilesRouter,
  snapshots: snapshotsRouter,
  rent: rentRouter,
  applications: applicationsRouter,
  spreadsheet: spreadsheetRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
