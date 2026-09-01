import { getSupabase, isSupabaseConfigured } from "./supabase";

export const STUDENT_APP_BUCKET = "student-apps";
export const STUDENT_APK_OBJECT = "android/room-revenue-student.apk";
export const STUDENT_APK_MANIFEST = "android/latest.json";
export const STUDENT_APP_ID = "com.roomrevenue.student";
export const STUDENT_PORTAL_START = "student";
/** Keep in sync with apps/student_app/pubspec.yaml `version`. */
export const STUDENT_APP_VERSION_NAME = "1.1.1";
export const STUDENT_APP_VERSION_CODE = 3;

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
