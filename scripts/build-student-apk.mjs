#!/usr/bin/env node
/**
 * Builds the student WebView APK and optionally uploads it to the
 * private Supabase `student-apps` bucket.
 *
 * Requires ANDROID_HOME (or ANDROID_SDK_ROOT) and a JDK.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const project = resolve(root, "apps/student-apk");
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";
const upload = process.argv.includes("--upload");

if (!sdk || !existsSync(sdk)) {
  console.error("ANDROID_HOME is not set. Install the Android SDK, then re-run:");
  console.error("  ANDROID_HOME=/path/to/Sdk npm run build:student-apk");
  process.exit(1);
}

process.env.ANDROID_HOME = sdk;
process.env.ANDROID_SDK_ROOT = sdk;

const gradle = existsSync(resolve(project, "gradlew"))
  ? resolve(project, "gradlew")
  : "gradle";

const assemble = spawnSync(gradle, [":app:assembleRelease"], {
  cwd: project,
  stdio: "inherit",
  env: process.env,
});
if (assemble.status !== 0) process.exit(assemble.status ?? 1);

const apk = resolve(project, "app/build/outputs/apk/release/app-release.apk");
if (!existsSync(apk)) {
  console.error("Gradle finished but the release APK was not found.");
  process.exit(1);
}
console.log(`Built ${apk}`);

if (!upload) process.exit(0);

const uploaded = spawnSync(
  "npx",
  ["supabase", "storage", "cp", apk, "ss:///student-apps/android/room-revenue-student.apk", "--linked"],
  { cwd: root, stdio: "inherit" },
);
if (uploaded.status !== 0) {
  console.error("APK built, but upload to Supabase failed. Sign in with `npx supabase login` and retry with --upload.");
  process.exit(uploaded.status ?? 1);
}
