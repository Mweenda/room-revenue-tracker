import { createAppCaller } from "../trpc";

export type { StudentAccountRow, EvictTenantResult } from "./students";
export type { RentIncrementRow } from "./rent";

async function caller() {
  return createAppCaller();
}

export async function fetchBeds() {
  return (await caller()).beds.list();
}

export async function fetchBillingRecords() {
  return (await caller()).billing.list();
}

export async function fetchPayments() {
  return (await caller()).payments.list();
}

export async function submitPayment(...args: Parameters<typeof import("./payments").submitPayment>) {
  return (await caller()).payments.submit(args[0]);
}

export async function verifyPayment(id: string) {
  return (await caller()).payments.verify({ id });
}

export async function rejectPayment(id: string, reason: string) {
  return (await caller()).payments.reject({ id, reason });
}

export async function updatePayment(...args: Parameters<typeof import("./payments").updatePayment>) {
  return (await caller()).payments.update(args[0]);
}

export async function recordManualPayment(...args: Parameters<typeof import("./payments").recordManualPayment>) {
  return (await caller()).payments.recordManual(args[0]);
}

export async function fetchIssues() {
  return (await caller()).issues.list();
}

export async function submitIssue(...args: Parameters<typeof import("./issues").submitIssue>) {
  return (await caller()).issues.submit(args[0]);
}

export async function updateIssueStatus(...args: Parameters<typeof import("./issues").updateIssueStatus>) {
  return (await caller()).issues.updateStatus({
    id: args[0],
    status: args[1],
    resolutionNote: args[2],
  });
}

export async function fetchStudentNotifications() {
  return (await caller()).notifications.list();
}

export async function markStudentNotificationRead(id: string) {
  return (await caller()).notifications.markRead({ id });
}

export async function ensureRentDueNotification() {
  return (await caller()).notifications.ensureRentDue();
}

export async function fetchLandlordNotifications() {
  return (await caller()).landlordInbox.list();
}

export async function markLandlordNotificationReadRemote(id: string) {
  return (await caller()).landlordInbox.markRead({ id });
}

export async function markAllLandlordNotificationsReadRemote() {
  return (await caller()).landlordInbox.markAllRead();
}

export async function ensureLandlordInbox() {
  return (await caller()).landlordInbox.ensure();
}

export async function fetchUtilities() {
  return (await caller()).utilities.list();
}

export async function upsertUtility(...args: Parameters<typeof import("./utilities").upsertUtility>) {
  return (await caller()).utilities.upsert(args[0]);
}

export async function toggleUtilitySettled(...args: Parameters<typeof import("./utilities").toggleUtilitySettled>) {
  return (await caller()).utilities.toggleSettled({
    blockCode: args[0],
    month: args[1],
    studentName: args[2],
  });
}

export async function fetchStudentAccounts(input?: { includeInactive?: boolean }) {
  return (await caller()).students.list(input);
}

export async function evictTenant(...args: Parameters<typeof import("./students").evictTenant>) {
  return (await caller()).students.evict(args[0]);
}

export async function updateStudentAccount(...args: Parameters<typeof import("./students").updateStudentAccount>) {
  return (await caller()).students.updateAccount(args[0]);
}

export async function onboardStudent(...args: Parameters<typeof import("./tenants").onboardStudent>) {
  return (await caller()).tenants.onboard(args[0]);
}

export async function updateStudent(...args: Parameters<typeof import("./tenants").updateStudent>) {
  return (await caller()).tenants.update(args[0]);
}

export async function vacateBedSpace(bedId: string) {
  return (await caller()).tenants.vacate({ bedId });
}

export { uploadStudentProfilePhoto, uploadTenantMedia } from "./tenants";

export async function completeStudentOnboarding(...args: Parameters<typeof import("./tenants").completeStudentOnboarding>) {
  return (await caller()).tenants.completeOnboarding(args[0]);
}

export async function listVacantBedsForOnboarding(...args: Parameters<typeof import("./tenants").listVacantBedsForOnboarding>) {
  return (await caller()).tenants.vacantForOnboarding({ gender: args[0] });
}

export async function updateLandlordProfile(...args: Parameters<typeof import("./profiles").updateLandlordProfile>) {
  return (await caller()).profiles.updateLandlord(args[0]);
}

export async function persistFinancialSnapshot(...args: Parameters<typeof import("./snapshots").persistFinancialSnapshot>) {
  return (await caller()).snapshots.persist(args[0]);
}

export async function applyRentIncrement(...args: Parameters<typeof import("./rent").applyRentIncrement>) {
  return (await caller()).rent.applyIncrement(args[0]);
}

export async function reconcileAllOccupancy() {
  return (await caller()).occupancy.reconcileAll();
}

export async function reconcileBedSpace(bedId: string) {
  return (await caller()).occupancy.reconcileBed({ bedId });
}

export async function findTenantOnBed(bedId: string) {
  return (await caller()).occupancy.findOnBed({ bedId });
}

export async function findTenantByEmail(email: string) {
  return (await caller()).occupancy.findByEmail({ email });
}

export async function saveOccupancyAdmin(...args: Parameters<typeof import("./occupancyAdmin").saveOccupancyAdmin>) {
  return (await caller()).occupancy.saveAdmin(args[0]);
}
