import { useMemo, useState } from "react";
import { AlertTriangle, BedDouble, Bell, CheckCircle, ChevronRight, MessageCircle, UserPlus, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import {
  composeLandlordWhatsApp,
  formatLandlordInboxTime,
  formatLandlordMessageTimestamp,
  landlordNotificationView,
  pageActionLabel,
  resolveNotificationContact,
  type LandlordNotification,
  type LandlordNotificationKind,
} from "../../lib/landlordNotifications";
import { launchWhatsApp } from "../../lib/whatsappLaunch";
import type { BedSpace, BillingRecord, IssueStatus, LandlordView, MaintenanceIssue, Payment, RoomGender } from "../../lib/types";
import { fmtKwacha } from "../../lib/billing";
import type { StudentAccountRow } from "../../lib/api/students";
import { buttonStyles, GLASS_POPOVER, HOVER_ROW, HOVER_SURFACE } from "./primitives";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const KIND_ICON: Record<LandlordNotificationKind, typeof Bell> = {
  rent_overdue: AlertTriangle,
  payment_submitted: Bell,
  payment_verified: CheckCircle,
  maintenance_submitted: Wrench,
  student_application: UserPlus,
};

const KIND_TONE: Record<LandlordNotificationKind, string> = {
  rent_overdue: "bg-red-100 text-red-700",
  payment_submitted: "bg-amber-100 text-amber-800",
  payment_verified: "bg-emerald-100 text-emerald-700",
  maintenance_submitted: "bg-blue-100 text-blue-700",
  student_application: "bg-violet-100 text-violet-700",
};

function openWhatsApp(phone: string, text: string) {
  void launchWhatsApp({ phone, text }).catch((err) => {
    toast.error(err instanceof Error ? err.message : "Could not open WhatsApp");
  });
}

export function LandlordNotificationBell({
  items,
  loading,
  unread,
  billingRecords,
  beds,
  students,
  payments,
  issues,
  onMarkRead,
  onMarkAllRead,
  onPanelOpen,
  onGoTo,
  verifyPay,
  rejectPay,
  updateIssueStatus,
  approveApplication,
  rejectApplication,
  onAfterAction,
}: {
  items: LandlordNotification[];
  loading: boolean;
  unread: number;
  billingRecords: BillingRecord[];
  beds: BedSpace[];
  students: StudentAccountRow[];
  payments: Payment[];
  issues: MaintenanceIssue[];
  onMarkRead: (item: LandlordNotification) => void;
  onMarkAllRead: () => void;
  onPanelOpen?: () => void;
  onGoTo: (item: LandlordNotification) => void;
  verifyPay: (id: string) => Promise<void>;
  rejectPay: (id: string, reason: string) => Promise<void>;
  updateIssueStatus: (id: string, status: IssueStatus, resolutionNote?: string) => Promise<void>;
  approveApplication: (input: { applicationId: string; bedId: string; rentAmount?: number | null; moveInDate?: string | null }) => Promise<{ fullName: string; bedSpaceId: string; email: string; inviteSent: boolean }>;
  rejectApplication: (input: { applicationId: string; reason: string }) => Promise<unknown>;
  onAfterAction?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LandlordNotification | null>(null);

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) onPanelOpen?.();
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
            className={`${HOVER_SURFACE} relative p-2 rounded-2xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100`}
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center shadow-sm shadow-red-500/40">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          className={`${GLASS_POPOVER} w-[min(24rem,calc(100vw-2rem))] p-0 overflow-hidden`}
        >
          <div className="px-4 py-3.5 border-b border-white/40 dark:border-white/10 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Notifications</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {unread > 0 ? `${unread} unread` : "You're all caught up"}
              </p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className={`${HOVER_SURFACE} rounded-xl px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300`}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="p-1.5 max-h-[min(28rem,70vh)] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-slate-400">Loading notifications…</p>
            ) : items.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <div className="mx-auto mb-3 w-11 h-11 rounded-2xl bg-white/50 dark:bg-slate-800/60 border border-white/50 dark:border-white/10 shadow-sm flex items-center justify-center">
                  <Bell size={18} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">No notifications yet</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Overdue rent, payments, maintenance, and bed-space applications will show up here.
                </p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = KIND_ICON[item.kind];
                  const unreadRow = !item.readAt;
                  const view: LandlordView = landlordNotificationView(item);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          onMarkRead(item);
                          setSelected(item);
                        }}
                        className={`${HOVER_ROW} w-full text-left px-3 py-2.5 flex items-start gap-3 rounded-2xl ${
                          unreadRow ? "bg-emerald-50/55 dark:bg-emerald-950/35" : ""
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${KIND_TONE[item.kind]}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={`text-sm truncate ${unreadRow ? "font-bold text-slate-900 dark:text-slate-50" : "font-semibold text-slate-800 dark:text-slate-200"}`}>
                              {item.title}
                            </p>
                            <span className="text-[11px] text-slate-400 shrink-0">
                              {formatLandlordInboxTime(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{item.preview}</p>
                        </div>
                        <div className="flex flex-col items-center gap-2 pt-1 shrink-0">
                          {unreadRow && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" aria-label="Unread" />}
                          <ChevronRight size={14} className="text-slate-300" />
                        </div>
                        <span className="sr-only">Open {view} notification</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <LandlordNotificationDialog
        item={selected}
        billingRecords={billingRecords}
        beds={beds}
        students={students}
        payments={payments}
        issues={issues}
        onClose={() => setSelected(null)}
        onGoTo={(item) => {
          setSelected(null);
          onGoTo(item);
        }}
        verifyPay={verifyPay}
        rejectPay={rejectPay}
        updateIssueStatus={updateIssueStatus}
        approveApplication={approveApplication}
        rejectApplication={rejectApplication}
        onAfterAction={onAfterAction}
      />
    </>
  );
}

function LandlordNotificationDialog({
  item,
  billingRecords,
  beds,
  students,
  payments,
  issues,
  onClose,
  onGoTo,
  verifyPay,
  rejectPay,
  updateIssueStatus,
  approveApplication,
  rejectApplication,
  onAfterAction,
}: {
  item: LandlordNotification | null;
  billingRecords: BillingRecord[];
  beds: BedSpace[];
  students: StudentAccountRow[];
  payments: Payment[];
  issues: MaintenanceIssue[];
  onClose: () => void;
  onGoTo: (item: LandlordNotification) => void;
  verifyPay: (id: string) => Promise<void>;
  rejectPay: (id: string, reason: string) => Promise<void>;
  updateIssueStatus: (id: string, status: IssueStatus, resolutionNote?: string) => Promise<void>;
  approveApplication: (input: { applicationId: string; bedId: string; rentAmount?: number | null; moveInDate?: string | null }) => Promise<{ fullName: string; bedSpaceId: string; email: string; inviteSent: boolean }>;
  rejectApplication: (input: { applicationId: string; reason: string }) => Promise<unknown>;
  onAfterAction?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [bedId, setBedId] = useState("");
  const [rent, setRent] = useState("");
  const [moveInDate, setMoveInDate] = useState("");

  const contact = useMemo(
    () => item ? resolveNotificationContact(item, { billingRecords, beds, students }) : null,
    [item, billingRecords, beds, students],
  );
  const payment = item?.paymentId ? payments.find((row) => row.id === item.paymentId) : undefined;
  const issue = item?.issueId ? issues.find((row) => row.id === item.issueId) : undefined;
  const applicationId = item?.kind === "student_application" ? item.metadata.applicationId : undefined;
  const applicantGender = (item?.metadata.gender === "Male" || item?.metadata.gender === "Female")
    ? (item.metadata.gender as RoomGender)
    : null;
  const vacantBeds = useMemo(() => {
    if (!applicationId) return [] as BedSpace[];
    return beds.filter((bed) =>
      bed.status === "vacant" &&
      (!applicantGender || !bed.roomGender || bed.roomGender === applicantGender),
    );
  }, [applicationId, applicantGender, beds]);
  const whatsappText = item && contact
    ? composeLandlordWhatsApp(item.kind, contact, item.metadata)
    : "";

  async function run(action: () => Promise<void>, success: string): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      onAfterAction?.();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete that action");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function sendWhatsApp() {
    if (!contact?.phone) {
      toast.error("This student has no phone number on file");
      return;
    }
    try {
      openWhatsApp(contact.phone, whatsappText);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open WhatsApp");
    }
  }

  const Icon = item ? KIND_ICON[item.kind] : Bell;
  const pendingPayment = item?.kind === "payment_submitted" && payment?.status !== "verified" && payment?.status !== "rejected";
  const openIssue = item?.kind === "maintenance_submitted" && issue?.status !== "resolved";

  return (
    <Dialog
      open={Boolean(item)}
      onOpenChange={(next) => {
        if (!next) {
          setRejectOpen(false);
          setResolveOpen(false);
          setAssignOpen(false);
          setRejectReason("");
          setResolveNote("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-lg">
        {item && contact && (
          <>
            <DialogHeader className="text-left pr-6">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${KIND_TONE[item.kind]}`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base leading-snug">{item.title}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {formatLandlordMessageTimestamp(item.createdAt)}
                    {contact.bedId ? ` · ${contact.bedId}` : ""}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
              {item.body}
            </div>

            {payment?.proofUrl && (
              <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-slate-200">
                <img src={payment.proofUrl} alt="Payment proof" className="w-full max-h-40 object-contain bg-slate-50" />
              </a>
            )}
            {issue?.imageUrl && (
              <a href={issue.imageUrl} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-slate-200">
                <img src={issue.imageUrl} alt="Maintenance photo" className="w-full max-h-40 object-cover" />
              </a>
            )}

            {item.kind !== "student_application" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">WhatsApp reminder</p>
              <p className="text-xs text-slate-600 whitespace-pre-line">{whatsappText}</p>
              {!contact.phone && (
                <p className="text-xs text-amber-700">No phone number on file for this student.</p>
              )}
            </div>
            )}

            {rejectOpen && (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="notif-reject">
                  {applicationId ? "Rejection reason" : "Rejection reason"}
                </label>
                <textarea
                  id="notif-reject"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={applicationId
                    ? "e.g. Not a current or incoming student of this boarding house"
                    : "e.g. Reference does not match our records"}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            )}

            {resolveOpen && (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="notif-resolve">
                  Resolution note
                </label>
                <textarea
                  id="notif-resolve"
                  rows={3}
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="What was done to close this complaint"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {item.kind !== "student_application" && (
                <button
                  type="button"
                  className={buttonStyles.primary}
                  disabled={busy || !contact.phone}
                  onClick={sendWhatsApp}
                >
                  <MessageCircle size={15} /> Send WhatsApp
                </button>
              )}

              {applicationId && !assignOpen && !rejectOpen && (
                <>
                  <button
                    type="button"
                    className={buttonStyles.primary}
                    disabled={busy}
                    onClick={() => {
                      const first = vacantBeds[0];
                      setBedId(first?.id ?? "");
                      setRent(first ? String(first.rentAmount) : "");
                      setMoveInDate(new Date().toISOString().slice(0, 10));
                      setAssignOpen(true);
                    }}
                  >
                    <BedDouble size={15} /> Assign bed space
                  </button>
                  <button
                    type="button"
                    className={buttonStyles.danger}
                    disabled={busy}
                    onClick={() => setRejectOpen(true)}
                  >
                    <X size={15} /> Reject request
                  </button>
                </>
              )}

              {applicationId && assignOpen && (
                <div className="w-full space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Assign a vacant bed</p>
                  {vacantBeds.length === 0 ? (
                    <p className="text-sm text-amber-700">
                      No vacant {applicantGender ? `${applicantGender.toLowerCase()} ` : ""}beds are available. Free a bed on Students, then try again.
                    </p>
                  ) : (
                    <>
                      <label className="block text-xs font-semibold text-slate-600">
                        Bed space
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={bedId}
                          onChange={(e) => {
                            const next = e.target.value;
                            setBedId(next);
                            const bed = vacantBeds.find((row) => row.id === next);
                            if (bed) setRent(String(bed.rentAmount));
                          }}
                        >
                          {vacantBeds.map((bed) => (
                            <option key={bed.id} value={bed.id}>
                              {bed.identifier || bed.id} · {bed.roomGender ?? "Any"} · {fmtKwacha(bed.rentAmount)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-semibold text-slate-600">
                          Monthly rent
                          <input
                            type="number"
                            min="0"
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                            value={rent}
                            onChange={(e) => setRent(e.target.value)}
                          />
                        </label>
                        <label className="block text-xs font-semibold text-slate-600">
                          Move-in date
                          <input
                            type="date"
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                            value={moveInDate}
                            onChange={(e) => setMoveInDate(e.target.value)}
                          />
                        </label>
                      </div>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={buttonStyles.outline}
                      disabled={busy}
                      onClick={() => setAssignOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={buttonStyles.primary}
                      disabled={busy || !bedId}
                      onClick={async () => {
                        const rentAmount = Number(rent);
                        const ok = await run(
                          () => approveApplication({
                            applicationId,
                            bedId,
                            rentAmount: Number.isFinite(rentAmount) && rentAmount > 0 ? rentAmount : null,
                            moveInDate: moveInDate || null,
                          }).then(() => undefined),
                          "Bed space assigned. An invite email will be sent if possible.",
                        );
                        if (ok) {
                          setAssignOpen(false);
                          onClose();
                        }
                      }}
                    >
                      Confirm assignment
                    </button>
                  </div>
                </div>
              )}

              {applicationId && rejectOpen && (
                <>
                  <button
                    type="button"
                    className={buttonStyles.outline}
                    disabled={busy}
                    onClick={() => { setRejectOpen(false); setRejectReason(""); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={buttonStyles.danger}
                    disabled={busy || !rejectReason.trim()}
                    onClick={async () => {
                      const ok = await run(
                        () => rejectApplication({ applicationId, reason: rejectReason.trim() }).then(() => undefined),
                        "Application rejected",
                      );
                      if (ok) {
                        setRejectOpen(false);
                        setRejectReason("");
                        onClose();
                      }
                    }}
                  >
                    Confirm reject
                  </button>
                </>
              )}

              {pendingPayment && item.paymentId && !rejectOpen && (
                <>
                  <button
                    type="button"
                    className={buttonStyles.primary}
                    disabled={busy}
                    onClick={() => run(() => verifyPay(item.paymentId!), "Payment verified")}
                  >
                    <CheckCircle size={15} /> Verify payment
                  </button>
                  <button
                    type="button"
                    className={buttonStyles.danger}
                    disabled={busy}
                    onClick={() => setRejectOpen(true)}
                  >
                    Reject
                  </button>
                </>
              )}
              {pendingPayment && item.paymentId && rejectOpen && (
                <>
                  <button
                    type="button"
                    className={buttonStyles.outline}
                    disabled={busy}
                    onClick={() => { setRejectOpen(false); setRejectReason(""); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={buttonStyles.danger}
                    disabled={busy || !rejectReason.trim()}
                    onClick={async () => {
                      const ok = await run(
                        () => rejectPay(item.paymentId!, rejectReason.trim()),
                        "Payment rejected",
                      );
                      if (ok) { setRejectOpen(false); setRejectReason(""); }
                    }}
                  >
                    Confirm reject
                  </button>
                </>
              )}

              {openIssue && item.issueId && !resolveOpen && (
                <>
                  {issue?.status !== "in_progress" && (
                    <button
                      type="button"
                      className={buttonStyles.neutral}
                      disabled={busy}
                      onClick={() => run(() => updateIssueStatus(item.issueId!, "in_progress"), "Marked in progress")}
                    >
                      Start work
                    </button>
                  )}
                  <button
                    type="button"
                    className={buttonStyles.outline}
                    disabled={busy}
                    onClick={() => setResolveOpen(true)}
                  >
                    Resolve
                  </button>
                </>
              )}
              {openIssue && item.issueId && resolveOpen && (
                <>
                  <button
                    type="button"
                    className={buttonStyles.outline}
                    disabled={busy}
                    onClick={() => { setResolveOpen(false); setResolveNote(""); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={buttonStyles.primary}
                    disabled={busy}
                    onClick={async () => {
                      const ok = await run(
                        () => updateIssueStatus(item.issueId!, "resolved", resolveNote.trim() || undefined),
                        "Complaint resolved",
                      );
                      if (ok) { setResolveOpen(false); setResolveNote(""); }
                    }}
                  >
                    Confirm resolved
                  </button>
                </>
              )}

              <button
                type="button"
                className={buttonStyles.outline}
                onClick={() => onGoTo(item)}
              >
                {pageActionLabel(item)}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
