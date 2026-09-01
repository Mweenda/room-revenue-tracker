#!/usr/bin/env node
/**
 * Builds the Flutter student WebView APK and optionally uploads it
 * to the private Supabase `student-apps` bucket with versioned objects.
 */
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const project = resolve(root, "apps/student_app");
const home = process.env.HOME || "";
const flutterBin =
  process.env.FLUTTER_BIN ||
  (home && existsSync(resolve(home, ".local/flutter/bin/flutter"))
    ? resolve(home, ".local/flutter/bin/flutter")
    : "flutter");
const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  (home && existsSync(resolve(home, "Android/Sdk")) ? resolve(home, "Android/Sdk") : "");
const jdk =
  process.env.JAVA_HOME ||
  (home && existsSync(resolve(home, ".local/jdk-17/bin/java")) ? resolve(home, ".local/jdk-17") : "");
const upload = process.argv.includes("--upload");

if (!existsSync(project)) {
  console.error("Flutter project missing at apps/student_app");
  process.exit(1);
}

process.env.ANDROID_HOME = sdk;
process.env.ANDROID_SDK_ROOT = sdk;
if (jdk) process.env.JAVA_HOME = jdk;

if (sdk) {
  const flutterSdk = home && existsSync(resolve(home, ".local/flutter"))
    ? resolve(home, ".local/flutter")
    : process.env.FLUTTER_ROOT || "";
  const localProps = [`sdk.dir=${sdk.replace(/\\/g, "\\\\")}`];
  if (flutterSdk) localProps.push(`flutter.sdk=${flutterSdk.replace(/\\/g, "\\\\")}`);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(resolve(project, "android/local.properties"), `${localProps.join("\n")}\n`);
}

const flutterApk = resolve(project, "build/app/outputs/flutter-apk/app-release.apk");
const staged = resolve(root, "apps/student-apk/app/build/outputs/apk/release/app-release.apk");
const preferFlutter = process.argv.includes("--flutter");
const flutterOk = preferFlutter && (existsSync(flutterBin) || flutterBin === "flutter");
let builtFrom = "";

if (flutterOk) {
  const build = spawnSync(flutterBin, ["build", "apk", "--release"], {
    cwd: project,
    stdio: "inherit",
    env: process.env,
  });
  if (build.status === 0 && existsSync(flutterApk)) {
    mkdirSync(resolve(staged, ".."), { recursive: true });
    copyFileSync(flutterApk, staged);
    builtFrom = flutterApk;
  } else {
    console.warn("Flutter build did not produce an APK; assembling the Java WebView shell.");
  }
}

if (!builtFrom) {
  const javaProject = resolve(root, "apps/student-apk");
  if (sdk) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(resolve(javaProject, "local.properties"), `sdk.dir=${sdk.replace(/\\/g, "\\\\")}\n`);
  }
  const gradle =
    home && existsSync(resolve(home, ".local/gradle-8.9/bin/gradle"))
      ? resolve(home, ".local/gradle-8.9/bin/gradle")
      : "gradle";
  const javaBuild = spawnSync(gradle, [":app:assembleRelease", "--no-daemon"], {
    cwd: javaProject,
    stdio: "inherit",
    env: process.env,
  });
  if (javaBuild.status !== 0) process.exit(javaBuild.status ?? 1);
  if (!existsSync(staged)) {
    console.error("Java assembleRelease finished but the release APK was not found.");
    process.exit(1);
  }
  builtFrom = staged;
}

console.log(`Built ${builtFrom}`);

if (!upload) process.exit(0);

const uploaded = spawnSync(process.execPath, [resolve(root, "scripts/upload-student-apk.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (uploaded.status !== 0) {
  console.error("APK built, but upload to Supabase failed.");
  process.exit(uploaded.status ?? 1);
}
