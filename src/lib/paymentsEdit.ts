import type { Payment, PaymentMethod } from "./types";

export type PaymentEditInput = {
  amount: number;
  method: PaymentMethod;
  transactionRef: string;
  submittedAt: string;
  studentName: string;
  bedSpaceId: string;
};

export function applyPaymentEdit(payment: Payment, input: PaymentEditInput): Payment {
  if (!(input.amount > 0)) throw new Error("Amount must be greater than zero");
  if (!input.transactionRef.trim()) throw new Error("A transaction reference is required");
  if (!input.studentName.trim()) throw new Error("A student name is required");
  if (!input.bedSpaceId.trim()) throw new Error("A bed space is required");
  if (input.method !== "Airtel" && input.method !== "MTN" && input.method !== "Cash") {
    throw new Error("Choose Airtel, MTN, or Cash");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.submittedAt)) throw new Error("Use a valid payment date");

  return {
    ...payment,
    amount: input.amount,
    method: input.method,
    transactionRef: input.transactionRef.trim(),
    submittedAt: input.submittedAt,
    studentName: input.studentName.trim(),
    bedSpaceId: input.bedSpaceId.trim(),
  };
}

export function lastVerifiedPayment(
  payments: Payment[],
  bedSpaceId: string,
  studentName?: string | null,
): Payment | null {
  const name = studentName?.trim().toLowerCase();
  const matches = payments.filter((payment) => {
    if (payment.status !== "verified") return false;
    if (payment.bedSpaceId === bedSpaceId) return true;
    return Boolean(name && payment.studentName.trim().toLowerCase() === name);
  });
  matches.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return matches[0] ?? null;
}

export function paymentSearchHaystack(
  payment: Pick<Payment, "studentName" | "bedSpaceId" | "transactionRef" | "method" | "amount" | "submittedAt" | "status">,
): string {
  const amount = Number.isFinite(payment.amount) ? String(payment.amount) : "";
  const amountGrouped = Number.isFinite(payment.amount) ? payment.amount.toLocaleString("en-US") : "";
  const bed = payment.bedSpaceId ?? "";
  const submittedAt = payment.submittedAt ?? "";
  return [
    payment.studentName,
    bed,
    bed.replace(/[^a-zA-Z0-9]/g, ""),
    payment.method,
    payment.transactionRef,
    amount,
    amountGrouped,
    amount ? `k${amount}` : "",
    amountGrouped ? `k${amountGrouped}` : "",
    submittedAt,
    submittedAt.replace(/-/g, " "),
    payment.status,
  ].join(" ").toLowerCase();
}

export function matchesPaymentSearch(
  payment: Pick<Payment, "studentName" | "bedSpaceId" | "transactionRef" | "method" | "amount" | "submittedAt" | "status">,
  term: string,
): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  const haystack = paymentSearchHaystack(payment);
  const compactNeedle = needle.replace(/[^a-z0-9]/g, "");
  const compactHaystack = haystack.replace(/[^a-z0-9]/g, "");
  return haystack.includes(needle) || (compactNeedle.length > 0 && compactHaystack.includes(compactNeedle));
}
