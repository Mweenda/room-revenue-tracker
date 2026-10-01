import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { buttonStyles, ModalFrame } from "./primitives";
import { hideWhatsAppWeb, openWhatsAppWebWindow, subscribeWhatsAppSession } from "../../lib/whatsappLaunch";

export function WhatsAppHost() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => subscribeWhatsAppSession((session) => setUrl(session.webUrl)), []);

  if (!url) return null;

  return (
    <ModalFrame onClose={hideWhatsAppWeb} className="max-w-6xl max-h-[min(92dvh,56rem)]">
      <div className="px-5 py-3 border-b border-white/40 dark:border-white/10 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">WhatsApp Web</h3>
          <p className="text-[11px] text-slate-500">
            Stays inside Room Revenue Tracker. If the panel is blank, WhatsApp blocked embedding — use the window instead.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openWhatsAppWebWindow(url)}
            className={`${buttonStyles.outline} px-3 py-1.5 text-xs min-h-0`}
          >
            <ExternalLink size={13} /> Open window
          </button>
          <button type="button" onClick={hideWhatsAppWeb} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Close WhatsApp Web">
            <X size={18} />
          </button>
        </div>
      </div>
      <iframe
        title="WhatsApp Web"
        src={url}
        className="w-full flex-1 min-h-[28rem] bg-white"
        allow="clipboard-read; clipboard-write"
        referrerPolicy="no-referrer"
      />
    </ModalFrame>
  );
}
