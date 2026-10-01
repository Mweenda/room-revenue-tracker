import { upsertUserPreferences } from "./api/preferences";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export const STUDENT_APP_BUCKET = "student-apps";
export const STUDENT_APK_OBJECT = "android/room-revenue-student.apk";
export const STUDENT_APK_MANIFEST = "android/latest.json";
export const STUDENT_APP_ID = "com.roomrevenue.student";
export const STUDENT_PORTAL_START = "student";
/** Path the APK WebView loads so logout/auth replaceState cannot fall back to the landlord landing page. */
export const STUDENT_PORTAL_PATH = "/student";
export const STUDENT_SHELL_UA_TOKEN = "RoomRevenueStudent";
export const STUDENT_SHELL_STORAGE_KEY = "rrt-student-shell";
/** Keep in sync with apps/student_app/pubspec.yaml `version`. */
export const STUDENT_APP_VERSION_NAME = "1.1.3";
export const STUDENT_APP_VERSION_CODE = 5;

export function studentApkReleaseObject(versionName = STUDENT_APP_VERSION_NAME, versionCode = STUDENT_APP_VERSION_CODE): string {
  return `android/releases/${versionName}+${versionCode}/room-revenue-student.apk`;
}

const AD_STORAGE_PREFIX = "rrt-student-welcome-ad:";
const SIGNED_URL_TTL_SECONDS = 120;

export type StudentAppManifest = {
  applicationId: string;
  versionName: string;
  versionCode: number;
  object: string;
  releaseObject: string;
  releasedAt: string;
};

export type StudentAppDownload =
  | { available: true; url: string; fileName: string; versionName?: string; versionCode?: number }
  | { available: false; reason: "offline" | "missing" | "unauthorized" };

export function studentManifestFromUnknown(value: unknown): StudentAppManifest | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.versionName !== "string" || typeof record.versionCode !== "number") return null;
  if (typeof record.object !== "string" || typeof record.releaseObject !== "string") return null;
  return {
    applicationId: typeof record.applicationId === "string" ? record.applicationId : STUDENT_APP_ID,
    versionName: record.versionName,
    versionCode: record.versionCode,
    object: record.object,
    releaseObject: record.releaseObject,
    releasedAt: typeof record.releasedAt === "string" ? record.releasedAt : "",
  };
}

type ShellStorage = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;

function defaultShellStorage(): ShellStorage {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function studentPortalLaunchParam(search = typeof window === "undefined" ? "" : window.location.search): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("app") === STUDENT_PORTAL_START;
}

export function isStudentPortalPath(pathname = ""): boolean {
  return /(?:^|\/)student\/?$/.test(pathname);
}

export function isStudentShellUserAgent(ua = ""): boolean {
  return ua.includes(STUDENT_SHELL_UA_TOKEN);
}

export function studentShellRemembered(storage: Pick<Storage, "getItem"> | null = defaultShellStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(STUDENT_SHELL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberStudentShell(storage: Pick<Storage, "setItem"> | null = defaultShellStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STUDENT_SHELL_STORAGE_KEY, "1");
  } catch {
    // Private mode / WebView storage can throw.
  }
}

export function forgetStudentShell(storage: Pick<Storage, "removeItem"> | null = defaultShellStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(STUDENT_SHELL_STORAGE_KEY);
  } catch {
    // Private mode / WebView storage can throw.
  }
}

export type StudentShellDetectInput = {
  search?: string;
  pathname?: string;
  userAgent?: string;
  capacitorNative?: boolean;
  storage?: ShellStorage;
};

export function detectStudentNativeShell(input: StudentShellDetectInput = {}): boolean {
  const search = input.search ?? (typeof window === "undefined" ? "" : window.location.search);
  const pathname = input.pathname ?? (typeof window === "undefined" ? "" : window.location.pathname);
  const userAgent = input.userAgent ?? (typeof navigator === "undefined" ? "" : navigator.userAgent);
  const capacitorNative =
    input.capacitorNative ??
    (typeof window === "undefined"
      ? false
      : Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()));
  const storage = input.storage === undefined ? defaultShellStorage() : input.storage;

  const native = capacitorNative || isStudentShellUserAgent(userAgent);
  const onStudentRoute = studentPortalLaunchParam(search) || isStudentPortalPath(pathname);

  // APK / native UA: stay on the student portal even if replaceState drops /student.
  if (native) {
    rememberStudentShell(storage);
    return true;
  }

  // Browser: /student is the student portal for this URL only. Do not pin the
  // whole tab, or the landlord cannot open the landing page again.
  if (onStudentRoute) return true;
  forgetStudentShell(storage);
  return false;
}

export function isStudentNativeShell(): boolean {
  return detectStudentNativeShell();
}

/** Keep the student APK on `/student` so later replaceState(pathname) cannot open the landlord landing page. */
export function studentShellLocation(
  pathname = "/",
  search = "",
  extra: Record<string, string | null | undefined> = {},
  forceShell = false,
): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const shell = forceShell || studentPortalLaunchParam(search) || isStudentPortalPath(pathname);
  let path = pathname || "/";
  if (shell) {
    path = isStudentPortalPath(pathname)
      ? pathname.replace(/\/+$/, "") || STUDENT_PORTAL_PATH
      : STUDENT_PORTAL_PATH;
    params.delete("app");
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function pinStudentShellLocation(): void {
  if (typeof window === "undefined") return;
  if (!detectStudentNativeShell()) return;
  const next = studentShellLocation(window.location.pathname, window.location.search, {}, true);
  const current = `${window.location.pathname}${window.location.search}`;
  if (next !== current) {
    window.history.replaceState({}, "", `${next}${window.location.hash}`);
  }
}

export function welcomeAdStorageKey(studentId: string): string {
  return `${AD_STORAGE_PREFIX}${studentId.trim() || "anonymous"}`;
}

export function shouldShowWelcomeAd(studentId: string, storage: Pick<Storage, "getItem"> | null = typeof window === "undefined" ? null : window.localStorage): boolean {
  if (!studentId || studentId === "guest-student") return false;
  if (!storage) return true;
  return storage.getItem(welcomeAdStorageKey(studentId)) !== "seen";
}

export function markWelcomeAdSeen(studentId: string, storage: Pick<Storage, "setItem"> | null = typeof window === "undefined" ? null : window.localStorage): void {
  if (!studentId || !storage) return;
  storage.setItem(welcomeAdStorageKey(studentId), "seen");
  if (!isSupabaseConfigured) return;
  void upsertUserPreferences({ welcomeAdSeenAt: new Date().toISOString() }).catch(() => undefined);
}

export async function createStudentApkDownload(): Promise<StudentAppDownload> {
  if (!isSupabaseConfigured) return { available: false, reason: "offline" };
  const sb = getSupabase();
  if (!sb) return { available: false, reason: "offline" };

  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) return { available: false, reason: "unauthorized" };

  const { data, error } = await sb.storage
    .from(STUDENT_APP_BUCKET)
    .createSignedUrl(STUDENT_APK_OBJECT, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return { available: false, reason: "missing" };

  let versionName: string | undefined;
  let versionCode: number | undefined;
  const { data: manifestFile } = await sb.storage.from(STUDENT_APP_BUCKET).download(STUDENT_APK_MANIFEST);
  if (manifestFile) {
    try {
      const manifest = studentManifestFromUnknown(JSON.parse(await manifestFile.text()));
      if (manifest) {
        versionName = manifest.versionName;
        versionCode = manifest.versionCode;
      }
    } catch {
      // Latest APK is still downloadable without a manifest.
    }
  }

  return {
    available: true,
    url: data.signedUrl,
    fileName: STUDENT_APK_OBJECT.split("/").pop() ?? "room-revenue-student.apk",
    versionName,
    versionCode,
  };
}
