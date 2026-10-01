import { useEffect, useMemo, useState } from "react";
import { Copy, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { buttonStyles, inputStyles, ModalFrame } from "./primitives";
import { bedLabel } from "../../lib/students";
import {
  composeRentReminder,
  formatWhatsAppNumberList,
  resolveBulkReminderText,
  studentsForWhatsAppReminder,
  whatsappBroadcastUrl,
  whatsappChatUrl,
  type WhatsAppReminderFilter,
} from "../../lib/whatsapp";
import type { StudentAccountRow } from "../../lib/api/students";

function openChat(url: string) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.href = url;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function WhatsAppGateway({
  students,
  selectedIds,
  preferredFilter,
}: {
  students: StudentAccountRow[];
  selectedIds: Set<string>;
  preferredFilter?: WhatsAppReminderFilter;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<WhatsAppReminderFilter>(
    selectedIds.size > 0 ? "selected" : preferredFilter ?? "unpaid",
  );
  const [customMessage, setCustomMessage] = useState("");

  const recipients = useMemo(
    () => studentsForWhatsAppReminder(students, filter, selectedIds),
    [students, filter, selectedIds],
  );

  const bulkMessage = useMemo(
    () => resolveBulkReminderText(customMessage, recipients[0]?.due_date),
    [customMessage, recipients],
  );

  const numberList = useMemo(
    () => formatWhatsAppNumberList(recipients.map((row) => row.phone)),
    [recipients],
  );

  useEffect(() => {
    if (selectedIds.size > 0) setFilter("selected");
  }, [selectedIds]);

  function messageFor(row: StudentAccountRow): string {
    if (customMessage.trim()) {
      return customMessage.replaceAll("{name}", row.full_name).replaceAll("{bed}", bedLabel(row));
    }
    return composeRentReminder({
      name: row.full_name,
      bedLabel: bedLabel(row),
      balance: row.total_balance ?? 0,
      dueDate: row.due_date ?? "the 1st of the month",
      daysPastDue: row.days_past_due ?? 0,
      status: row.billing_status,
    });
  }

  function sendOne(row: StudentAccountRow) {
    try {
      openChat(whatsappChatUrl(row.phone ?? "", messageFor(row)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open WhatsApp");
    }
  }

  async function sendAll() {
    if (recipients.length === 0) return;
    try {
      const copied = numberList ? await copyText(numberList) : false;
      openChat(whatsappBroadcastUrl(bulkMessage));
      toast.success(
        recipients.length === 1
          ? "WhatsApp opened with the reminder"
          : `WhatsApp opened for ${recipients.length} students`,
        {
          description: copied
            ? "The numbers are on the clipboard. In WhatsApp choose New broadcast or pick those contacts, then send once."
            : "In WhatsApp choose New broadcast or pick the listed contacts, then send once.",
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open WhatsApp");
    }
  }

  async function copyNumbers() {
    if (!numberList) {
      toast.error("No WhatsApp numbers to copy");
      return;
    }
    const copied = await copyText(numberList);
    if (copied) toast.success(`Copied ${recipients.length} WhatsApp number${recipients.length === 1 ? "" : "s"}`);
    else toast.error("Could not copy the numbers");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFilter(selectedIds.size > 0 ? "selected" : preferredFilter ?? "unpaid");
          setOpen(true);
        }}
        className={`${buttonStyles.outline} px-3 py-1.5 text-xs min-h-0`}
      >
        <MessageCircle size={13} />
        {selectedIds.size > 0
          ? `WhatsApp ${selectedIds.size} selected`
          : "WhatsApp reminders"}
      </button>

      {open && (
        <ModalFrame onClose={() => setOpen(false)} className="max-w-lg">
          <div className="px-5 py-4 border-b border-white/40 dark:border-white/10 flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-900">WhatsApp gateway</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Send one reminder to every unpaid or overdue student in this list. WhatsApp opens with the message; pick those contacts or a broadcast list and send once.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 p-1"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {([
                  ["selected", "Selected"],
                  ["unpaid", "Unpaid / grace"],
                  ["past_grace", "Past 5-day grace"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Optional shared reminder. Use {name} and {bed} only for one-off sends. Leave blank for the default rent reminder."
                className={`${inputStyles} resize-none`}
              />

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {recipients.length} student{recipients.length === 1 ? "" : "s"} with a WhatsApp number.
                </p>
                <button
                  type="button"
                  onClick={copyNumbers}
                  disabled={!numberList}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <Copy size={12} /> Copy numbers
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y">
                {recipients.map((row) => (
                  <div key={row.id} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{row.full_name}</p>
                      <p className="text-xs text-slate-500">{bedLabel(row)} · {row.phone}</p>
                    </div>
                    <button type="button" onClick={() => sendOne(row)} className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1">
                      <Send size={12} /> One
                    </button>
                  </div>
                ))}
                {recipients.length === 0 && (
                  <p className="px-3 py-8 text-center text-sm text-slate-400">
                    {filter === "selected"
                      ? "Select unpaid students in the table, or switch to Unpaid / grace."
                      : "No matching students have a phone number."}
                  </p>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button type="button" onClick={() => setOpen(false)} className={`${buttonStyles.outline} flex-1`}>Close</button>
              <button
                type="button"
                disabled={recipients.length === 0}
                onClick={() => { void sendAll(); }}
                className={`${buttonStyles.primary} flex-1`}
              >
                {recipients.length === 0
                  ? "Nothing to send"
                  : recipients.length === 1
                    ? "Send reminder"
                    : `Send to all ${recipients.length}`}
              </button>
            </div>
        </ModalFrame>
      )}
    </>
  );
}
