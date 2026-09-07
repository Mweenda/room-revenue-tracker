import type { BedSpace, RoomGender } from "./types";

export const INVITE_MIN_TTL_MS = 15 * 60 * 1000;
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export type OnboardingStep = "gender" | "bed" | "profile" | "password" | "done";

export function inviteStillValid(
  createdAt: Date | string,
  now = new Date(),
  minTtlMs = INVITE_MIN_TTL_MS,
  expiresAt?: Date | string,
): boolean {
  const nowMs = now.getTime();
  if (expiresAt) {
    return nowMs <= new Date(expiresAt).getTime();
  }
  const createdMs = new Date(createdAt).getTime();
  const age = nowMs - createdMs;
  return age >= 0 && age <= Math.max(minTtlMs, INVITE_TTL_MS);
}

export function vacantBedsForGender(
  beds: BedSpace[],
  gender: RoomGender,
  assignedBedId?: string | null,
): BedSpace[] {
  return beds.filter((bed) => {
    if (bed.roomGender && bed.roomGender !== gender) return false;
    const assigned = assignedBedId && bed.id === assignedBedId;
    const vacant = !bed.student || bed.status === "vacant";
    return assigned || vacant;
  });
}

const STEPS: OnboardingStep[] = ["gender", "bed", "profile", "password", "done"];

export function nextOnboardingStep(step: OnboardingStep): OnboardingStep {
  const idx = STEPS.indexOf(step);
  return STEPS[Math.min(idx + 1, STEPS.length - 1)];
}

export function validateStudentOnboarding(input: {
  step: OnboardingStep;
  gender?: RoomGender | null;
  bedId?: string | null;
  beds?: BedSpace[];
  assignedBedId?: string | null;
  name?: string;
  phone?: string;
  nrc?: string;
  moveInDate?: string;
  password?: string;
  confirmPassword?: string;
}): { ok: boolean; error?: string } {
  if (input.step === "gender") {
    if (input.gender !== "Male" && input.gender !== "Female") {
      return { ok: false, error: "Select your gender to continue." };
    }
    return { ok: true };
  }

  if (input.step === "bed") {
    if (!input.gender) return { ok: false, error: "Select your gender first." };
    if (!input.bedId) return { ok: false, error: "Choose a vacant bed space." };
    const options = vacantBedsForGender(input.beds ?? [], input.gender, input.assignedBedId);
    const bed = options.find((row) => row.id === input.bedId);
    if (!bed) return { ok: false, error: "That bed is not available for your gender." };
    if (bed.roomGender && bed.roomGender !== input.gender) {
      return { ok: false, error: "Choose a bed that matches your gender." };
    }
    return { ok: true };
  }

  if (input.step === "profile") {
    if (!input.name?.trim()) return { ok: false, error: "A full name is required." };
    if (!input.moveInDate) return { ok: false, error: "Choose your move-in date." };
    return { ok: true };
  }

  if (input.step === "password") {
    const password = input.password ?? "";
    if (password.length < 6) return { ok: false, error: "Your password must be at least 6 characters long." };
    if (password !== input.confirmPassword) return { ok: false, error: "The passwords do not match." };
    return { ok: true };
  }

  return { ok: true };
}
