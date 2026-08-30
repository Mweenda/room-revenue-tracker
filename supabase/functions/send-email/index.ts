// Notification dispatch.
//
// The client sends a notification *type* and a tenant id — never a recipient
// address, subject, or HTML body. Everything the recipient sees is built here
// from the database, so this endpoint cannot be used as an open mail relay.
//
// Authorization: `auth: 'user'` requires a valid JWT, and the handler
// additionally requires the caller to own a landlord profile. Every dispatch is
// recorded in `notification_log`.
//
// npm: imports are loaded inside POST so OPTIONS preflight can return 200 even
// if a dependency fails to boot.

const FROM = "Room Revenue Tracker <noreply@roomrevenue.com>";

type NotificationType =
  | "welcome"
  | "payment_approved"
  | "payment_rejected"
  | "rent_due"
  | "maintenance_update"
  | "rent_increase";

const NOTIFICATION_TYPES: NotificationType[] = [
  "welcome",
  "payment_approved",
  "payment_rejected",
  "rent_due",
  "maintenance_update",
  "rent_increase",
];

type Details = {
  amount?: number;
  dueDate?: string;
  reason?: string;
  bedSpace?: string;
  oldAmount?: number;
  newAmount?: number;
  effectiveDate?: string;
  setupUrl?: string;
  setupKind?: "invite" | "recovery";
};

/** Escapes untrusted values so landlord-supplied text cannot inject markup. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function kwacha(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `K${n.toLocaleString("en-US")}` : "K0";
}

function resolvePortalOrigin(request: Request): string {
  const origin = request.headers.get("origin")?.trim();
  if (origin && /^https?:\/\/[a-z0-9.[\]:-]+$/i.test(origin)) {
    return origin.replace(/\/$/, "");
  }
  const env = (Deno.env.get("PUBLIC_SITE_URL") ?? "").trim().replace(/\/$/, "");
  return env || "http://localhost:5173";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function withCors(response: Response): Response {
  const next = new Response(response.body, response);
  for (const [key, value] of Object.entries(corsHeaders)) {
    next.headers.set(key, value);
  }
  return next;
}

function studentSetupUrl(origin: string, tokenHash: string, kind: "invite" | "recovery"): string {
  const auth = kind === "recovery" ? "student-reset" : "student-confirm";
  const params = new URLSearchParams({ auth, token_hash: tokenHash, type: kind });
  return `${origin}/?${params.toString()}`;
}

function alreadyRegistered(message: string | undefined): boolean {
  const text = (message ?? "").toLowerCase();
  return text.includes("already") && (text.includes("registered") || text.includes("exist"));
}

type AuthEmailVia = "supabase_invite" | "supabase_recovery";

/** Sends GoTrue's Invite (or Recovery) template. Does not log or return tokens. */
async function sendSupabaseAuthEmail(
  admin: any,
  email: string,
  name: string,
  origin: string,
): Promise<{ via: AuthEmailVia } | { via: null; error: string }> {
  const invite = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name, role: "student" },
    redirectTo: `${origin}/?auth=student-confirm`,
  });
  if (!invite.error) {
    return { via: "supabase_invite" };
  }

  if (alreadyRegistered(invite.error.message)) {
    const recovery = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/?auth=student-reset`,
    });
    if (!recovery.error) {
      return { via: "supabase_recovery" };
    }
    return { via: null, error: recovery.error.message ?? "Recovery email failed" };
  }

  return { via: null, error: invite.error.message ?? "Invite email failed" };
}

async function createPasswordSetupLink(
  admin: any,
  email: string,
  name: string,
  origin: string,
): Promise<{ url: string; kind: "invite" | "recovery" } | null> {
  const invite = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { full_name: name, role: "student" },
      redirectTo: `${origin}/?auth=student-confirm`,
    },
  });

  if (!invite.error && invite.data?.properties?.hashed_token) {
    return { url: studentSetupUrl(origin, invite.data.properties.hashed_token, "invite"), kind: "invite" };
  }

  if (!alreadyRegistered(invite.error?.message)) {
    console.error("invite generateLink failed", invite.error);
    return null;
  }

  const recovery = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/?auth=student-reset` },
  });
  if (recovery.error || !recovery.data?.properties?.hashed_token) {
    console.error("recovery generateLink failed", recovery.error);
    return null;
  }
  return { url: studentSetupUrl(origin, recovery.data.properties.hashed_token, "recovery"), kind: "recovery" };
}

function shell(heading: string, colour: string, body: string, name: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: ${colour};">${esc(heading)}</h1>
      <p>Hi ${esc(name)},</p>
      ${body}
      <p>Best regards,<br>Room Revenue Tracker Team</p>
    </div>
  `;
}

function buildEmail(
  type: NotificationType,
  name: string,
  bedSpace: string | null,
  details: Details,
): { subject: string; html: string } {
  const bed = bedSpace ? esc(bedSpace) : null;

  switch (type) {
    case "welcome": {
      const setupUrl = details.setupUrl ? String(details.setupUrl) : "";
      const cta = details.setupKind === "recovery" ? "Set your password" : "Create your password";
      const setupBlock = setupUrl
        ? `<p>Click the button below to ${details.setupKind === "recovery" ? "choose a password" : "create a password"} and open your student portal.</p>
          <p style="margin: 28px 0;">
            <a href="${esc(setupUrl)}" style="background: #00855d; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 700; display: inline-block;">${esc(cta)}</a>
          </p>
          <p style="font-size: 12px; color: #64748b;">If the button does not work, copy this link into your browser:<br>${esc(setupUrl)}</p>`
        : `<p>Ask your landlord to resend your portal invite so you can create a password.</p>`;
      return {
        subject: "Create your student portal password",
        html: shell("You're invited to the student portal", "#00855d", `
          <p>Your landlord has assigned you a bed space${bed ? `: <strong>${bed}</strong>` : ""}.</p>
          ${setupBlock}
          <p>After you save your password you will be taken straight to your billing, payments, and maintenance page.</p>
        `, name),
      };
    }

    case "payment_approved":
      return {
        subject: "Payment Approved - Room Revenue Tracker",
        html: shell("Payment Approved", "#00855d", `
          <p>Great news! Your payment of <strong>${kwacha(details.amount)}</strong> has been approved.</p>
          <p>Your account is now up to date. Thank you for your prompt payment.</p>
        `, name),
      };

    case "payment_rejected":
      return {
        subject: "Payment Action Required - Room Revenue Tracker",
        html: shell("Payment Rejected", "#dc2626", `
          <p>Your payment submission was rejected for the following reason:</p>
          <p><em>${esc(details.reason || "Please contact your landlord for more details.")}</em></p>
          <p>Please resubmit your payment proof with the correct information.</p>
        `, name),
      };

    case "rent_due":
      return {
        subject: "Rent Payment Reminder - Room Revenue Tracker",
        html: shell("Rent Payment Reminder", "#f59e0b", `
          <p>This is a friendly reminder that your rent payment is due on
          <strong>${esc(details.dueDate ?? "the 1st of the month")}</strong>.</p>
          <p>Please ensure your payment is submitted before the due date to avoid late fees.</p>
        `, name),
      };

    case "maintenance_update":
      return {
        subject: "Maintenance Update - Room Revenue Tracker",
        html: shell("Maintenance Update", "#00855d", `
          <p>There's an update regarding your maintenance request${bed ? ` for <strong>${bed}</strong>` : ""}.</p>
          <p>Please log in to your portal to view the latest status.</p>
        `, name),
      };

    case "rent_increase": {
      const oldAmount = Number(details.oldAmount ?? 0);
      const newAmount = Number(details.newAmount ?? 0);
      const row = (label: string, value: string, bold = false) => `
        <tr>
          <td style="padding: 6px 14px 6px 0; color: #475569;">${label}</td>
          <td style="padding: 6px 0;${bold ? " font-weight: bold;" : ""}">${value}</td>
        </tr>`;

      return {
        subject: "Notice of Rent Adjustment - Room Revenue Tracker",
        html: shell("Notice of Rent Adjustment", "#00855d", `
          <p>We are writing to let you know that the monthly rent for your bed space${bed ? ` <strong>${bed}</strong>` : ""} will change.</p>
          <table style="border-collapse: collapse; margin: 16px 0;">
            ${row("Current rent", kwacha(oldAmount), true)}
            ${row("New rent", kwacha(newAmount), true)}
            ${row("Increase", kwacha(newAmount - oldAmount))}
            ${row("Effective from", esc(details.effectiveDate ?? "the next billing cycle"), true)}
          </table>
          <p>Your current billing cycle is not affected — the new amount applies from the effective date onwards.</p>
          <p>If you have any questions, please contact your landlord.</p>
        `, name),
      };
    }
  }
}

type FunctionContext = {
  supabase: any;
  supabaseAdmin: any;
};

async function createUserContext(request: Request): Promise<
  | { data: FunctionContext; error: null }
  | { data: null; error: { message: string; code?: string; status: number } }
> {
  const { createAdminClient, createContextClient, verifyAuth } = await import(
    "npm:@supabase/server/core"
  );
  const { data: auth, error } = await verifyAuth(request, { auth: "user" });
  if (error) return { data: null, error };
  try {
    return {
      data: {
        supabase: createContextClient({
          auth: { token: auth.token, keyName: auth.keyName },
        }),
        supabaseAdmin: createAdminClient(),
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create Supabase clients";
    return { data: null, error: { message, status: 500 } };
  }
}

async function dispatchNotification(request: Request, ctx: FunctionContext): Promise<Response> {
  try {
    const { data: caller } = await ctx.supabase.auth.getUser();
    if (!caller.user?.id) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // profiles.id is not auth.users.id — use the server helper from migration 006.
    const { data: isLandlord, error: authzError } = await ctx.supabase.rpc("is_landlord");
    if (authzError) {
      console.error("is_landlord failed", authzError);
      return Response.json({ error: "Authorization check failed" }, { status: 500 });
    }
    if (!isLandlord) {
      return Response.json({ error: "Landlord access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const type = body?.type as NotificationType | undefined;
    const tenantId = body?.tenantId as string | undefined;
    const details: Details = body?.details ?? {};

    if (!type || !NOTIFICATION_TYPES.includes(type)) {
      return Response.json(
        { error: `type must be one of: ${NOTIFICATION_TYPES.join(", ")}` },
        { status: 400 },
      );
    }
    if (typeof tenantId !== "string" || tenantId.trim() === "") {
      return Response.json({ error: "tenantId is required" }, { status: 400 });
    }

    // User-scoped client so RLS keeps this landlord on their own tenants.
    const { data: tenant, error: tenantError } = await ctx.supabase
      .from("tenants")
      .select("id, full_name, email, bed_space_id, status")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError) {
      console.error("tenant lookup failed", tenantError);
      return Response.json({ error: "Could not load the tenant" }, { status: 500 });
    }
    if (!tenant) {
      return Response.json({ error: "Tenant not found" }, { status: 404 });
    }
    if (!tenant.email) {
      return Response.json({ error: "Tenant has no email on file" }, { status: 422 });
    }

    const origin = resolvePortalOrigin(request);
    const detailsForMail: Details = { ...details };
    let via: AuthEmailVia | "resend_fallback" | "resend" | null = null;
    let delivered = false;
    let failureReason: string | null = null;

    if (type === "welcome") {
      const authEmail = await sendSupabaseAuthEmail(
        ctx.supabaseAdmin,
        tenant.email,
        tenant.full_name ?? "Resident",
        origin,
      );
      if (authEmail.via) {
        via = authEmail.via;
        delivered = true;
      } else {
        failureReason = authEmail.error;
        const setup = await createPasswordSetupLink(
          ctx.supabaseAdmin,
          tenant.email,
          tenant.full_name ?? "Resident",
          origin,
        );
        if (setup) {
          detailsForMail.setupUrl = setup.url;
          detailsForMail.setupKind = setup.kind;
        }
      }
    }

    const { subject, html } = buildEmail(
      type,
      tenant.full_name ?? "Resident",
      tenant.bed_space_id ?? null,
      detailsForMail,
    );

    if (!delivered) {
      const skipResend = type === "welcome" && !detailsForMail.setupUrl;
      if (!skipResend) {
        try {
          const { Resend } = await import("npm:resend");
          const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");
          const { error: sendError } = await resend.emails.send({
            from: FROM,
            to: tenant.email,
            subject,
            html,
          });
          if (sendError) throw sendError;
          delivered = true;
          via = type === "welcome" ? "resend_fallback" : "resend";
        } catch (error) {
          delivered = false;
          const resendError = error instanceof Error ? error.message : String(error);
          failureReason = failureReason ? `${failureReason}; resend: ${resendError}` : resendError;
          console.error("email delivery failed", error);
        }
      }
    }

    // Audit trail for every dispatch attempt, delivered or not.
    // Never persist invite URLs or hashed tokens — those are secrets.
    await ctx.supabase.from("notification_log").insert({
      tenant_id: tenant.id,
      recipient_email: tenant.email,
      notification_type: type,
      subject,
      status: delivered ? "sent" : "failed",
      error_message: failureReason,
      actor_email: caller.user.email ?? null,
      details: {
        bedSpace: details.bedSpace ?? tenant.bed_space_id ?? null,
        via,
        setupKind: detailsForMail.setupKind ?? (via === "supabase_recovery" ? "recovery" : via === "supabase_invite" ? "invite" : null),
      },
    });

    return delivered
      ? Response.json({ success: true, via })
      : Response.json({ error: "Email delivery failed" }, { status: 502 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Notification dispatch failed" }, { status: 500 });
  }
}

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }));
    }

    const { data: ctx, error } = await createUserContext(req);
    if (error) {
      return withCors(
        Response.json({ error: error.message, code: error.code }, { status: error.status }),
      );
    }

    return withCors(await dispatchNotification(req, ctx));
  },
};
