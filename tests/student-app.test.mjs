import test from "node:test";
import assert from "node:assert/strict";

globalThis.__vite_env__ = { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" };

const app = await import("../src/lib/studentApp.ts");

test("the student APK lives in a private apps bucket", () => {
  assert.equal(app.STUDENT_APP_BUCKET, "student-apps");
  assert.equal(app.STUDENT_APK_OBJECT, "android/room-revenue-student.apk");
  assert.equal(app.STUDENT_APP_ID, "com.roomrevenue.student");
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
