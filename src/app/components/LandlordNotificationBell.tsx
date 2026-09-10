import { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle, ChevronRight, MessageCircle, Wrench } from "lucide-react";
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
import { whatsappChatUrl } from "../../lib/whatsapp";
import type { BedSpace, BillingRecord, IssueStatus, LandlordView, MaintenanceIssue, Payment } from "../../lib/types";
import type { StudentAccountRow } from "../../lib/api/students";
import { buttonStyles } from "./primitives";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const KIND_ICON: Record<LandlordNotificationKind, typeof Bell> = {
  rent_overdue: AlertTriangle,
  payment_submitted: Bell,
  payment_verified: CheckCircle,
  maintenance_submitted: Wrench,
};

const KIND_TONE: Record<LandlordNotificationKind, string> = {
  rent_overdue: "bg-red-100 text-red-700",
  payment_submitted: "bg-amber-100 text-amber-800",
  payment_verified: "bg-emerald-100 text-emerald-700",
  maintenance_submitted: "bg-blue-100 text-blue-700",
};

function openWhatsApp(phone: string, text: string) {
  const url = whatsappChatUrl(phone, text);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.href = url;
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
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[min(24rem,calc(100vw-2rem))] p-0 overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-white/50 dark:border-white/10 shadow-2xl"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Notifications</p>
              <p className="text-xs text-slate-500">
                {unread > 0 ? `${unread} unread` : "You're all caught up"}
              </p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">Loading notifications…</p>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="mx-auto mb-3 w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Bell size={18} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-900">No notifications yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Overdue rent, new payments, and maintenance complaints will show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
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
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                          unreadRow ? "bg-emerald-50/70" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${KIND_TONE[item.kind]}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={`text-sm truncate ${unreadRow ? "font-bold text-slate-900" : "font-semibold text-slate-800"}`}>
                              {item.title}
                            </p>
                            <span className="text-[11px] text-slate-400 shrink-0">
                              {formatLandlordInboxTime(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.preview}</p>
                        </div>
                        <div className="flex flex-col items-center gap-2 pt-1 shrink-0">
                          {unreadRow && <span className="w-2 h-2 rounded-full bg-emerald-500" aria-label="Unread" />}
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
  onAfterAction?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState("");

  const contact = useMemo(
    () => item ? resolveNotificationContact(item, { billingRecords, beds, students }) : null,
    [item, billingRecords, beds, students],
  );
  const payment = item?.paymentId ? payments.find((row) => row.id === item.paymentId) : undefined;
  const issue = item?.issueId ? issues.find((row) => row.id === item.issueId) : undefined;
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

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">WhatsApp reminder</p>
              <p className="text-xs text-slate-600 whitespace-pre-line">{whatsappText}</p>
              {!contact.phone && (
                <p className="text-xs text-amber-700">No phone number on file for this student.</p>
              )}
            </div>

            {rejectOpen && (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="notif-reject">
                  Rejection reason
                </label>
                <textarea
                  id="notif-reject"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Reference does not match our records"
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
              <button
                type="button"
                className={buttonStyles.primary}
                disabled={busy || !contact.phone}
                onClick={sendWhatsApp}
              >
                <MessageCircle size={15} /> Send WhatsApp
              </button>

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
