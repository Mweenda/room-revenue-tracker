import test from "node:test";
import assert from "node:assert/strict";

globalThis.__vite_env__ = { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" };

const app = await import("../src/lib/studentApp.ts");

test("the student APK lives in a private apps bucket", () => {
  assert.equal(app.STUDENT_APP_BUCKET, "student-apps");
  assert.equal(app.STUDENT_APK_OBJECT, "android/room-revenue-student.apk");
  assert.equal(app.STUDENT_APK_MANIFEST, "android/latest.json");
  assert.equal(app.STUDENT_APP_ID, "com.roomrevenue.student");
});

test("release objects are versioned so previous APKs stay in the bucket", () => {
  assert.equal(app.studentApkReleaseObject("1.1.0", 2), "android/releases/1.1.0+2/room-revenue-student.apk");
  const manifest = app.studentManifestFromUnknown({
    applicationId: "com.roomrevenue.student",
    versionName: "1.1.0",
    versionCode: 2,
    object: "android/room-revenue-student.apk",
    releaseObject: "android/releases/1.1.0+2/room-revenue-student.apk",
    releasedAt: "2026-08-31T00:00:00.000Z",
  });
  assert.equal(manifest?.versionName, "1.1.0");
  assert.equal(manifest?.versionCode, 2);
  assert.equal(app.studentManifestFromUnknown({ versionName: "1.1.0" }), null);
});

test("the student shell is detected from the app launch query", () => {
  assert.equal(app.studentPortalLaunchParam("app=student"), true);
  assert.equal(app.studentPortalLaunchParam("?app=student&auth=student-login"), true);
  assert.equal(app.studentPortalLaunchParam("app=landlord"), false);
});

test("the welcome ad shows once per student and skips guests", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, value); },
  };

  assert.equal(app.shouldShowWelcomeAd("guest-student", storage), false);
  assert.equal(app.shouldShowWelcomeAd("tenant-1", storage), true);
  app.markWelcomeAdSeen("tenant-1", storage);
  assert.equal(app.shouldShowWelcomeAd("tenant-1", storage), false);
  assert.equal(app.shouldShowWelcomeAd("tenant-2", storage), true);
});

test("an unconfigured client cannot mint a download URL", async () => {
  const result = await app.createStudentApkDownload();
  assert.equal(result.available, false);
  assert.equal(result.reason, "offline");
});
