import { getSupabase, isSupabaseConfigured } from "./supabase";

export const STUDENT_APP_BUCKET = "student-apps";
export const STUDENT_APK_OBJECT = "android/room-revenue-student.apk";
export const STUDENT_APP_ID = "com.roomrevenue.student";
export const STUDENT_PORTAL_START = "student";

const AD_STORAGE_PREFIX = "rrt-student-welcome-ad:";
const SIGNED_URL_TTL_SECONDS = 120;

export type StudentAppDownload =
  | { available: true; url: string; fileName: string }
  | { available: false; reason: "offline" | "missing" | "unauthorized" };

export function studentPortalLaunchParam(search = typeof window === "undefined" ? "" : window.location.search): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("app") === STUDENT_PORTAL_START;
}

export function isStudentNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(capacitor?.isNativePlatform?.() || studentPortalLaunchParam(window.location.search));
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
  return {
    available: true,
    url: data.signedUrl,
    fileName: STUDENT_APK_OBJECT.split("/").pop() ?? "room-revenue-student.apk",
  };
}
