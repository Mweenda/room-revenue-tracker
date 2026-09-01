#!/usr/bin/env node
/**
 * Uploads the latest student APK to the private `student-apps` bucket
 * as both a rolling latest object and a versioned release.
 *
 * Uses the linked Supabase CLI so this works on Node 20 (supabase-js
 * currently requires a native WebSocket, which Node 20 does not provide).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const apkCandidates = [
  resolve(root, "apps/student_app/build/app/outputs/flutter-apk/app-release.apk"),
  resolve(root, "apps/student-apk/app/build/outputs/apk/release/app-release.apk"),
];
const apk = apkCandidates.find((path) => existsSync(path));
if (!apk) {
  console.error("Release APK not found. Build it first.");
  process.exit(1);
}

function versionFromPubspec() {
  try {
    const text = readFileSync(resolve(root, "apps/student_app/pubspec.yaml"), "utf8");
    const match = text.match(/^version:\s*([^\s+]+)\+(\d+)/m);
    if (match) return { versionName: match[1], versionCode: Number(match[2]) };
  } catch {
    // Fall through.
  }
  return { versionName: "1.1.1", versionCode: 3 };
}

const { versionName, versionCode } = versionFromPubspec();
const releaseObject = `android/releases/${versionName}+${versionCode}/room-revenue-student.apk`;
const STUDENT_APP_BUCKET = "student-apps";
const STUDENT_APK_OBJECT = "android/room-revenue-student.apk";
const STUDENT_APK_MANIFEST = "android/latest.json";
const STUDENT_APP_ID = "com.roomrevenue.student";

function storageRm(dest) {
  spawnSync(
    "npx",
    ["supabase", "storage", "rm", "--experimental", "--linked", "--yes", dest],
    { cwd: root, stdio: "inherit", env: process.env },
  );
}

function storageCp(src, dest, contentType) {
  storageRm(dest);
  const result = spawnSync(
    "npx",
    [
      "supabase",
      "storage",
      "cp",
      "--experimental",
      "--linked",
      "--content-type",
      contentType,
      src,
      dest,
    ],
    { cwd: root, stdio: "inherit", env: process.env },
  );
  if (result.status !== 0) {
    console.error(`Failed to upload ${dest}`);
    process.exit(result.status ?? 1);
  }
}

storageCp(apk, `ss:///${STUDENT_APP_BUCKET}/${STUDENT_APK_OBJECT}`, "application/vnd.android.package-archive");
storageCp(apk, `ss:///${STUDENT_APP_BUCKET}/${releaseObject}`, "application/vnd.android.package-archive");

const manifest = {
  applicationId: STUDENT_APP_ID,
  versionName,
  versionCode,
  object: STUDENT_APK_OBJECT,
  releaseObject,
  releasedAt: new Date().toISOString(),
};
const outDir = resolve(root, "apps/student-apk/app/build/outputs/apk/release");
mkdirSync(outDir, { recursive: true });
const manifestPath = resolve(outDir, "latest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
storageCp(manifestPath, `ss:///${STUDENT_APP_BUCKET}/${STUDENT_APK_MANIFEST}`, "application/json");

console.log(`Uploaded ${STUDENT_APK_OBJECT} and ${releaseObject}`);
