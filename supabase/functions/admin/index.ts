// RRT admin operations.
//
// Actions (one endpoint):
//   • bootstrap-admin    — one-time seed of the RRT admin account. Guarded by
//     the ADMIN_BOOTSTRAP_SECRET shared secret (x-bootstrap-secret header).
//   • onboard-landlord   — creates a landlord auth user + profile.
//   • update-landlord    — edits a landlord's contact details.
//   • set-landlord-status— suspends / reactivates a landlord (profile flag + auth ban).
//   • delete-landlord    — removes a landlord account (blocked while they own property).
//   • log-login          — records an admin sign-in in the audit trail.
//
// Every action except bootstrap requires a valid admin JWT, verified inside the
// handler with the is_admin RPC (migration 014). Privileged writes use the
// service-role admin client. verify_jwt is disabled for this function (see
// supabase/config.toml) so the OPTIONS preflight and secret-guarded bootstrap
// can reach the handler.

const ADMIN_EMAIL = "admin@rrt.io";
const ADMIN_FULL_NAME = "RRT Admin";
const BAN_DURATION = "876000h"; // ~100 years

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bootstrap-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function withCors(response: Response): Response {
  const next = new Response(response.body, response);
  for (const [key, value] of Object.entries(corsHeaders)) {
    next.headers.set(key, value);
  }
  return next;
}

function alreadyRegistered(message: string | undefined): boolean {
  const text = (message ?? "").toLowerCase();
  return text.includes("already") && (text.includes("registered") || text.includes("exist"));
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type AdminContext = { admin: any; callerEmail: string };

/** Verifies the caller holds an admin JWT and returns a service-role client. */
async function requireAdmin(req: Request): Promise<AdminContext | { error: string; status: number }> {
  const { createAdminClient, createContextClient, verifyAuth } = await import(
    "npm:@supabase/server/core"
  );
  const { data: auth, error: authError } = await verifyAuth(req, { auth: "user" });
  if (authError) return { error: authError.message, status: authError.status };

  const caller = createContextClient({ auth: { token: auth.token, keyName: auth.keyName } });
  const { data: isAdmin, error: adminCheckError } = await caller.rpc("is_admin");
  if (adminCheckError) {
    console.error("is_admin failed", adminCheckError);
    return { error: "Authorization check failed", status: 500 };
  }
  if (!isAdmin) return { error: "Admin access required", status: 403 };

  const { data: userData } = await caller.auth.getUser();
  return { admin: createAdminClient(), callerEmail: userData?.user?.email ?? "" };
}

async function logAudit(
  admin: any,
  params: {
    actorEmail: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
    note?: string | null;
    landlordId?: string | null;
  },
): Promise<void> {
  try {
    await admin.from("audit_log").insert({
      actor_email: params.actorEmail || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      before: params.before ?? null,
      after: params.after ?? null,
      note: params.note ?? null,
      landlord_id: params.landlordId ?? null,
    });
  } catch (error) {
    console.error("audit log insert failed", error);
  }
}

/** Creates the auth user (or reuses/updates an existing one) and returns its id. */
async function ensureAuthUser(
  admin: any,
  email: string,
  password: string,
  fullName: string,
  role: "admin" | "landlord",
): Promise<{ userId: string } | { error: string; status: number }> {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (!created.error) {
    return { userId: created.data.user.id };
  }
  if (!alreadyRegistered(created.error.message)) {
    return { error: created.error.message ?? "Could not create the account", status: 400 };
  }

  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = list.data?.users?.find((u: any) => (u.email ?? "").toLowerCase() === email);
  if (!found) {
    return { error: "An account with this email already exists.", status: 409 };
  }
  await admin.auth.admin.updateUserById(found.id, {
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  return { userId: found.id };
}

/** Inserts or updates the profile row for a provisioned auth user; returns its id. */
async function upsertProfile(
  admin: any,
  params: {
    role: "admin" | "landlord";
    fullName: string;
    email: string;
    phone: string | null;
    address: string | null;
    authUserId: string;
  },
): Promise<{ id: string } | { error: string }> {
  const { data: existing, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", params.email)
    .maybeSingle();
  if (lookupError) return { error: lookupError.message };

  if (existing) {
    const { error } = await admin
      .from("profiles")
      .update({
        role: params.role,
        full_name: params.fullName,
        phone: params.phone,
        address: params.address,
        auth_user_id: params.authUserId,
        status: "active",
      })
      .eq("id", existing.id);
    return error ? { error: error.message } : { id: existing.id };
  }

  const { data: inserted, error } = await admin
    .from("profiles")
    .insert({
      role: params.role,
      full_name: params.fullName,
      email: params.email,
      phone: params.phone,
      address: params.address,
      auth_user_id: params.authUserId,
    })
    .select("id")
    .single();
  return error ? { error: error.message } : { id: inserted.id };
}

async function bootstrapAdmin(req: Request, body: any): Promise<Response> {
  const secret = (Deno.env.get("ADMIN_BOOTSTRAP_SECRET") ?? "").trim();
  if (!secret) {
    return Response.json({ error: "Bootstrap is not configured" }, { status: 503 });
  }
  const provided = (req.headers.get("x-bootstrap-secret") ?? "").trim();
  if (provided !== secret) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const password = typeof body?.password === "string" && body.password
    ? body.password
    : (Deno.env.get("ADMIN_BOOTSTRAP_PASSWORD") ?? "");
  if (!password) {
    return Response.json({ error: "An initial admin password is required" }, { status: 400 });
  }

  const { createAdminClient } = await import("npm:@supabase/server/core");
  const admin = createAdminClient();

  const user = await ensureAuthUser(admin, ADMIN_EMAIL, password, ADMIN_FULL_NAME, "admin");
  if ("error" in user) {
    return Response.json({ error: user.error }, { status: user.status });
  }

  const profile = await upsertProfile(admin, {
    role: "admin",
    fullName: ADMIN_FULL_NAME,
    email: ADMIN_EMAIL,
    phone: null,
    address: null,
    authUserId: user.userId,
  });
  if ("error" in profile) {
    return Response.json({ error: profile.error }, { status: 500 });
  }

  return Response.json({ success: true, email: ADMIN_EMAIL });
}

async function onboardLandlord(ctx: AdminContext, body: any): Promise<Response> {
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const address = typeof body?.address === "string" && body.address.trim() ? body.address.trim() : null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!fullName) return Response.json({ error: "The landlord's full name is required" }, { status: 400 });
  if (!isEmail(email)) return Response.json({ error: "A valid email address is required" }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "The initial password must be at least 8 characters" }, { status: 400 });

  const user = await ensureAuthUser(ctx.admin, email, password, fullName, "landlord");
  if ("error" in user) return Response.json({ error: user.error }, { status: user.status });

  const profile = await upsertProfile(ctx.admin, {
    role: "landlord",
    fullName,
    email,
    phone,
    address,
    authUserId: user.userId,
  });
  if ("error" in profile) return Response.json({ error: profile.error }, { status: 500 });

  await logAudit(ctx.admin, {
    actorEmail: ctx.callerEmail,
    action: "landlord.create",
    entityType: "landlord",
    entityId: profile.id,
    after: { full_name: fullName, email },
    note: `Onboarded landlord ${fullName}`,
    landlordId: profile.id,
  });

  return Response.json({ success: true, email, fullName });
}

async function updateLandlord(ctx: AdminContext, body: any): Promise<Response> {
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "A landlord id is required" }, { status: 400 });
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  if (!fullName) return Response.json({ error: "The landlord's full name is required" }, { status: 400 });
  const phone = typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const address = typeof body?.address === "string" && body.address.trim() ? body.address.trim() : null;

  const { data: before, error: loadError } = await ctx.admin
    .from("profiles").select("id, role, full_name, phone, address").eq("id", id).maybeSingle();
  if (loadError) return Response.json({ error: loadError.message }, { status: 500 });
  if (!before || before.role !== "landlord") return Response.json({ error: "Landlord not found" }, { status: 404 });

  const { error } = await ctx.admin
    .from("profiles").update({ full_name: fullName, phone, address }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await logAudit(ctx.admin, {
    actorEmail: ctx.callerEmail,
    action: "landlord.update",
    entityType: "landlord",
    entityId: id,
    before: { full_name: before.full_name, phone: before.phone, address: before.address },
    after: { full_name: fullName, phone, address },
    landlordId: id,
  });

  return Response.json({ success: true });
}

async function setLandlordStatus(ctx: AdminContext, body: any): Promise<Response> {
  const id = typeof body?.id === "string" ? body.id : "";
  const status = body?.status === "suspended" ? "suspended" : body?.status === "active" ? "active" : "";
  if (!id || !status) return Response.json({ error: "A landlord id and status are required" }, { status: 400 });

  const { data: profile, error: loadError } = await ctx.admin
    .from("profiles").select("id, role, status, auth_user_id, full_name").eq("id", id).maybeSingle();
  if (loadError) return Response.json({ error: loadError.message }, { status: 500 });
  if (!profile || profile.role !== "landlord") return Response.json({ error: "Landlord not found" }, { status: 404 });

  const { error } = await ctx.admin.from("profiles").update({ status }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Mirror the flag onto the auth user so a suspended landlord cannot sign in.
  if (profile.auth_user_id) {
    const ban = status === "suspended" ? BAN_DURATION : "none";
    const { error: banError } = await ctx.admin.auth.admin.updateUserById(profile.auth_user_id, { ban_duration: ban });
    if (banError) console.error("ban update failed", banError);
  }

  await logAudit(ctx.admin, {
    actorEmail: ctx.callerEmail,
    action: status === "suspended" ? "landlord.suspend" : "landlord.reactivate",
    entityType: "landlord",
    entityId: id,
    before: { status: profile.status },
    after: { status },
    note: `${status === "suspended" ? "Suspended" : "Reactivated"} ${profile.full_name}`,
    landlordId: id,
  });

  return Response.json({ success: true, status });
}

async function deleteLandlord(ctx: AdminContext, body: any): Promise<Response> {
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "A landlord id is required" }, { status: 400 });

  const { data: profile, error: loadError } = await ctx.admin
    .from("profiles").select("id, role, auth_user_id, full_name, email").eq("id", id).maybeSingle();
  if (loadError) return Response.json({ error: loadError.message }, { status: 500 });
  if (!profile || profile.role !== "landlord") return Response.json({ error: "Landlord not found" }, { status: 404 });

  const { count, error: countError } = await ctx.admin
    .from("blocks").select("code", { count: "exact", head: true }).eq("landlord_id", id);
  if (countError) return Response.json({ error: countError.message }, { status: 500 });
  if ((count ?? 0) > 0) {
    return Response.json(
      { error: "This landlord still owns properties. Reassign or remove their blocks before deleting." },
      { status: 409 },
    );
  }

  const { error: deleteError } = await ctx.admin.from("profiles").delete().eq("id", id);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });

  if (profile.auth_user_id) {
    const { error: authDeleteError } = await ctx.admin.auth.admin.deleteUser(profile.auth_user_id);
    if (authDeleteError) console.error("auth user delete failed", authDeleteError);
  }

  await logAudit(ctx.admin, {
    actorEmail: ctx.callerEmail,
    action: "landlord.delete",
    entityType: "landlord",
    entityId: id,
    before: { full_name: profile.full_name, email: profile.email },
    note: `Deleted landlord ${profile.full_name}`,
  });

  return Response.json({ success: true });
}

async function logLogin(ctx: AdminContext): Promise<Response> {
  await logAudit(ctx.admin, {
    actorEmail: ctx.callerEmail,
    action: "admin.login",
    entityType: "admin",
    note: `Admin ${ctx.callerEmail} signed in`,
  });
  return Response.json({ success: true });
}

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }));
    }

    try {
      const body = await req.json().catch(() => null);
      const action = body?.action;

      if (action === "bootstrap-admin") {
        return withCors(await bootstrapAdmin(req, body));
      }

      const adminActions = ["onboard-landlord", "update-landlord", "set-landlord-status", "delete-landlord", "log-login"];
      if (!adminActions.includes(action)) {
        return withCors(Response.json({ error: "Unknown action" }, { status: 400 }));
      }

      const ctx = await requireAdmin(req);
      if ("error" in ctx) {
        return withCors(Response.json({ error: ctx.error }, { status: ctx.status }));
      }

      switch (action) {
        case "onboard-landlord": return withCors(await onboardLandlord(ctx, body));
        case "update-landlord": return withCors(await updateLandlord(ctx, body));
        case "set-landlord-status": return withCors(await setLandlordStatus(ctx, body));
        case "delete-landlord": return withCors(await deleteLandlord(ctx, body));
        case "log-login": return withCors(await logLogin(ctx));
      }
      return withCors(Response.json({ error: "Unknown action" }, { status: 400 }));
    } catch (error) {
      console.error(error);
      return withCors(Response.json({ error: "Admin request failed" }, { status: 500 }));
    }
  },
};
