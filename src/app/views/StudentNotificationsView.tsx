import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowLeft,
  Bell,
  Building2,
  CheckCircle,
  ChevronRight,
  AlertTriangle,
  Wrench,
  TrendingUp,
  Trash2,
  MailOpen,
  MoreVertical,
} from "lucide-react";
import {
  NOTIFICATION_SENDER,
  formatInboxTime,
  formatMessageTimestamp,
  type StudentNotification,
  type StudentNotificationKind,
} from "../../lib/studentNotifications";
import { GLASS_PANEL } from "../components/primitives";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

const KIND_ICON: Record<StudentNotificationKind, typeof Bell> = {
  welcome: Building2,
  payment_approved: CheckCircle,
  payment_rejected: AlertTriangle,
  rent_due: Bell,
  maintenance_update: Wrench,
  rent_increase: TrendingUp,
  house: Building2,
};

const KIND_TONE: Record<StudentNotificationKind, string> = {
  welcome: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
  payment_approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
  payment_rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
  rent_due: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  maintenance_update: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  rent_increase: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200",
  house: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

const GLASS_MENU = `${GLASS_PANEL} rounded-2xl p-1 min-w-[12rem]`;

function useLongPress(onOpen: () => void, onMenu: () => void) {
  const timer = useRef<number | null>(null);
  const menuOpened = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);

  function clearTimer() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function onPointerDown(event: ReactPointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    menuOpened.current = false;
    startX.current = event.clientX;
    startY.current = event.clientY;
    clearTimer();
    timer.current = window.setTimeout(() => {
      menuOpened.current = true;
      onMenu();
    }, 480);
  }

  function onPointerMove(event: ReactPointerEvent) {
    if (timer.current == null) return;
    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    if (dx * dx + dy * dy > 100) clearTimer();
  }

  function onClick() {
    if (menuOpened.current) {
      menuOpened.current = false;
      return;
    }
    onOpen();
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clearTimer,
    onPointerCancel: clearTimer,
    onClick,
  };
}

function MessageActions({
  unread,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  unread: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <ContextMenuItem onSelect={onOpen}>Open message</ContextMenuItem>
      {unread && (
        <ContextMenuItem onSelect={onMarkRead}>
          <MailOpen size={15} /> Mark as read
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onSelect={onDelete}>
        <Trash2 size={15} /> Delete
      </ContextMenuItem>
    </>
  );
}

export function StudentNotificationsView({
  items,
  selected,
  loading,
  onOpen,
  onBack,
  onDismiss,
}: {
  items: StudentNotification[];
  selected: StudentNotification | null;
  loading: boolean;
  onOpen: (id: string) => void;
  onBack: () => void;
  onDismiss: (id: string) => void;
}) {
  const [menuItem, setMenuItem] = useState<StudentNotification | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentNotification | null>(null);

  if (selected) {
    const Icon = KIND_ICON[selected.kind];
    return (
      <div className="max-w-2xl mx-auto pb-2">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft size={16} /> Inbox
        </button>
        <article className={`${GLASS_PANEL} rounded-2xl overflow-hidden`}>
          <div className="px-5 py-4 border-b border-white/40 dark:border-white/10 flex items-start gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${KIND_TONE[selected.kind]}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{NOTIFICATION_SENDER}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatMessageTimestamp(selected.createdAt)}</p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteTarget(selected)}
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              aria-label="Delete message"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="px-5 py-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selected.title}</h2>
            <div className="space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
              {selected.body}
            </div>
          </div>
        </article>
        <DeleteConfirm target={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={() => {
          if (deleteTarget) onDismiss(deleteTarget.id);
          setDeleteTarget(null);
        }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-2">
      <div className={`${GLASS_PANEL} rounded-2xl overflow-hidden`}>
        {loading && items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">Loading messages…</p>
        ) : items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 shadow-sm flex items-center justify-center">
              <Bell size={20} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">No messages yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rent reminders, maintenance updates, and house notices will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100/80 dark:divide-slate-800/80">
            {items.map((item) => (
              <InboxRow
                key={item.id}
                item={item}
                onOpen={() => onOpen(item.id)}
                onMenu={() => setMenuItem(item)}
                onMarkRead={() => onOpen(item.id)}
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
          </ul>
        )}
      </div>

      {menuItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" aria-label="Close" onClick={() => setMenuItem(null)} />
          <div className={`relative w-full max-w-sm ${GLASS_PANEL} rounded-2xl p-2 shadow-2xl`}>
            <p className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{menuItem.title}</p>
            <button
              type="button"
              onClick={() => { const id = menuItem.id; setMenuItem(null); onOpen(id); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/60 dark:hover:bg-white/10"
            >
              <MailOpen size={16} /> Open message
            </button>
            {!menuItem.readAt && (
              <button
                type="button"
                onClick={() => { const id = menuItem.id; setMenuItem(null); onOpen(id); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/60 dark:hover:bg-white/10"
              >
                <CheckCircle size={16} /> Mark as read
              </button>
            )}
            <button
              type="button"
              onClick={() => { setDeleteTarget(menuItem); setMenuItem(null); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50/80 dark:hover:bg-red-950/40"
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </div>
      )}

      <DeleteConfirm target={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={() => {
        if (deleteTarget) onDismiss(deleteTarget.id);
        setDeleteTarget(null);
      }} />
    </div>
  );
}

function InboxRow({
  item,
  onOpen,
  onMenu,
  onMarkRead,
  onDelete,
}: {
  item: StudentNotification;
  onOpen: () => void;
  onMenu: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const Icon = KIND_ICON[item.kind];
  const unread = !item.readAt;
  const press = useLongPress(onOpen, onMenu);

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }}
            {...press}
            className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors duration-150 cursor-pointer select-none ${
              unread
                ? "bg-emerald-50/70 dark:bg-emerald-950/20"
                : "hover:bg-white/50 dark:hover:bg-slate-800/70"
            }`}
          >
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${KIND_TONE[item.kind]}`}>
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`text-sm truncate ${unread ? "font-bold text-slate-900 dark:text-slate-50" : "font-semibold text-slate-800 dark:text-slate-200"}`}>
                  {NOTIFICATION_SENDER}
                </p>
                <span className="text-[11px] text-slate-400 shrink-0">{formatInboxTime(item.createdAt)}</span>
              </div>
              <p className={`text-sm mt-0.5 truncate ${unread ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                {item.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{item.preview}</p>
            </div>
            <div className="flex flex-col items-center gap-2 pt-1 shrink-0">
              {unread && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" aria-label="Unread" />}
              <button
                type="button"
                aria-label="Message options"
                onClick={(event) => { event.stopPropagation(); onMenu(); }}
                onPointerDown={(event) => event.stopPropagation()}
                className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800"
              >
                <MoreVertical size={15} />
              </button>
              <ChevronRight size={15} className="text-slate-300 dark:text-slate-600" />
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className={GLASS_MENU}>
          <MessageActions unread={unread} onOpen={onOpen} onMarkRead={onMarkRead} onDelete={onDelete} />
        </ContextMenuContent>
      </ContextMenu>
    </li>
  );
}

function DeleteConfirm({
  target,
  onCancel,
  onConfirm,
}: {
  target: StudentNotification | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={Boolean(target)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent className={`${GLASS_PANEL} rounded-2xl`}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this message?</AlertDialogTitle>
          <AlertDialogDescription>
            {target ? `"${target.title}" will be removed from your inbox.` : "This message will be removed from your inbox."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
