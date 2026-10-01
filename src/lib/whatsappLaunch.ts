import {
  readWhatsAppClient,
  resolveWhatsAppLaunch,
  type WhatsAppClient,
} from "./whatsapp";

const WEB_WINDOW = "rrt-whatsapp-web";

type WhatsAppSession = { webUrl: string | null };
type SessionListener = (session: WhatsAppSession) => void;

let session: WhatsAppSession = { webUrl: null };
const listeners = new Set<SessionListener>();

function emit() {
  for (const listener of listeners) listener(session);
}

export function getWhatsAppSession(): WhatsAppSession {
  return session;
}

export function subscribeWhatsAppSession(listener: SessionListener): () => void {
  listeners.add(listener);
  listener(session);
  return () => {
    listeners.delete(listener);
  };
}

export function showWhatsAppWeb(url: string) {
  session = { webUrl: url };
  emit();
}

export function hideWhatsAppWeb() {
  session = { webUrl: null };
  emit();
}

export function launchNativeWhatsApp(url: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.display = "none";
  frame.src = url;
  document.body.appendChild(frame);
  window.setTimeout(() => frame.remove(), 4000);
}

export function openWhatsAppWebWindow(url: string): Window | null {
  const opened = window.open(url, WEB_WINDOW);
  opened?.focus();
  return opened;
}

function waitForAppHandoff(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (opened: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("visibilitychange", onVisibility);
      resolve(opened);
    };
    const onBlur = () => finish(true);
    const onVisibility = () => {
      if (document.hidden) finish(true);
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("visibilitychange", onVisibility);
    window.setTimeout(() => finish(!document.hasFocus() || document.hidden), ms);
  });
}

export async function launchWhatsApp(input: {
  phone?: string | null;
  text: string;
  client?: WhatsAppClient;
}): Promise<"app" | "web"> {
  const client = input.client ?? readWhatsAppClient();
  const { mode, nativeUrl, webUrl } = resolveWhatsAppLaunch(client, input);

  if (client === "web" || mode === "web") {
    showWhatsAppWeb(webUrl);
    return "web";
  }

  launchNativeWhatsApp(nativeUrl);
  if (client === "app") return "app";

  const openedApp = await waitForAppHandoff(1400);
  if (openedApp) return "app";
  showWhatsAppWeb(webUrl);
  return "web";
}
