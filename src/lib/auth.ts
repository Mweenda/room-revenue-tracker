const viteEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env)
  ? (import.meta as any).env
  : (globalThis as any).__vite_env__ ?? {};

// Opt-in only, and only meaningful for builds with no Supabase credentials
// (where there is no real data to protect). Never enable this for a deployment
// that points at a real project.
const DEMO_LOGIN_ENABLED = String(viteEnv.VITE_ENABLE_DEMO_LOGIN ?? '').trim() === 'true';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface OTPRequest {
  email: string;
  name: string;
}

export interface OTPVerification {
  email: string;
  otp: string;
}

export interface TenantNotification {
  /** The recipient address is resolved server-side from this id. */
  tenantId: string;
  type: 'payment_approved' | 'payment_rejected' | 'rent_due' | 'maintenance_update' | 'welcome' | 'rent_increase';
  details?: {
    amount?: number;
    dueDate?: string;
    reason?: string;
    bedSpace?: string;
    oldAmount?: number;
    newAmount?: number;
    effectiveDate?: string;
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface AuthenticatedStudent {
  id: string;
  name: string;
  email: string;
  phone: string;
  nrc: string;
  moveInDate: string;
  bedSpaceId: string;
  profileImageUrl?: string;
}

function mapTenantRow(row: {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  nrc: string | null;
  move_in_date: string | null;
  bed_space_id: string;
  profile_image_url?: string | null;
}, fallbackEmail?: string): AuthenticatedStudent {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email ?? fallbackEmail ?? '',
    phone: row.phone ?? '-',
    nrc: row.nrc ?? '-',
    moveInDate: row.move_in_date ?? '-',
    bedSpaceId: row.bed_space_id,
    profileImageUrl: row.profile_image_url ?? undefined,
  };
}

export async function fetchTenantByEmail(email: string) {
  const { getSupabase } = await import('./supabase');
  const sb = getSupabase();
  if (!sb) return null;

  const normalized = normalizeEmail(email);
  const { data, error } = await sb
    .from('tenants')
    .select('id, full_name, email, phone, nrc, move_in_date, bed_space_id, profile_image_url, auth_user_id')
    .eq('email', normalized)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function linkTenantToAuthUser(email: string): Promise<AuthenticatedStudent | null> {
  const { getSupabase } = await import('./supabase');
  const sb = getSupabase();
  if (!sb) return null;

  const { data: authData, error: authError } = await sb.auth.getUser();
  if (authError || !authData.user?.id) return null;

  const normalized = normalizeEmail(email || authData.user.email || '');
  if (!normalized) return null;

  const tenant = await fetchTenantByEmail(normalized);
  if (!tenant) return null;

  if (tenant.auth_user_id !== authData.user.id) {
    const { error: linkError } = await sb
      .from('tenants')
      .update({ auth_user_id: authData.user.id })
      .eq('id', tenant.id);
    if (linkError) throw linkError;
  }

  return mapTenantRow(tenant, normalized);
}

/**
 * Existence check that runs before the student has a session.
 *
 * Uses the `tenant_exists_for_email` RPC, which returns a bare boolean, so the
 * pre-login flow never needs read access to tenant rows. Falls back to a direct
 * lookup for deployments where migration 006 has not been applied yet.
 */
export async function tenantExistsForEmail(email: string): Promise<boolean> {
  const { getSupabase } = await import('./supabase');
  const sb = getSupabase();
  if (!sb) return false;

  const normalized = normalizeEmail(email);
  const { data, error } = await sb.rpc('tenant_exists_for_email', { p_email: normalized });
  if (!error) return data === true;

  const tenant = await fetchTenantByEmail(normalized);
  return Boolean(tenant);
}

export async function inviteStudentToPortal(email: string, _name: string): Promise<{ success: boolean; message: string }> {
  const { getSupabase } = await import('./supabase');
  const sb = getSupabase();
  if (!sb) {
    return { success: false, message: 'Database not configured, so no invite can be sent.' };
  }

  const tenant = await fetchTenantByEmail(email);
  if (!tenant) {
    return {
      success: false,
      message: 'No tenant profile exists for this email. The landlord must assign the bed space first.',
    };
  }

  const sent = await sendTenantNotification({
    tenantId: tenant.id,
    type: 'welcome',
    details: { bedSpace: tenant.bed_space_id },
  });

  return sent
    ? { success: true, message: 'Invite sent. The student can create a password from the email and will land in their portal.' }
    : { success: false, message: 'The tenant was saved, but the invite email could not be sent.' };
}

/**
 * Dispatches a tenant notification through the `send-email` Edge Function.
 *
 * The browser sends only a notification type and a tenant id — the function
 * resolves the recipient from the database and renders the body server-side, so
 * this path cannot be used to send arbitrary mail to arbitrary addresses.
 */
export async function sendTenantNotification(notification: TenantNotification): Promise<boolean> {
  const { tenantId, type, details } = notification;

  if (!tenantId) {
    console.warn(`Skipping ${type} notification: no tenant id was provided`);
    return false;
  }

  const { getSupabase } = await import('./supabase');
  const sb = getSupabase();
  if (!sb) {
    console.warn(`Email service unavailable in offline mode (${type})`);
    return false;
  }

  try {
    const { error } = await sb.functions.invoke('send-email', {
      body: { type, tenantId, details: details ?? {} },
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Failed to send ${type} notification:`, error);
    return false;
  }
}

export async function sendWelcomeEmail(tenantId: string, bedSpace?: string): Promise<boolean> {
  return sendTenantNotification({ tenantId, type: 'welcome', details: { bedSpace } });
}


// Request a one-time code. Issued and verified by Supabase Auth — there is no
// client-side code store, so a code cannot be read or forged in the browser.
export async function requestOTP(data: OTPRequest): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = normalizeEmail(data.email);
  const { getSupabase } = await import('./supabase');
  const sb = getSupabase();
  if (!sb) {
    return { success: false, message: 'Database not configured' };
  }

  if (!(await tenantExistsForEmail(normalizedEmail))) {
    return {
      success: false,
      message: 'No bed space is assigned to this email yet. Ask your landlord to onboard you first, then try again.',
    };
  }

  const { error } = await sb.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      data: { full_name: data.name, role: 'student' },
      emailRedirectTo: `${window.location.origin}/?auth=student-confirm`,
    },
  });
  return error
    ? { success: false, message: error.message }
    : { success: true, message: 'Verification code sent. Check your email and enter the 6-digit code below.' };
}

// Verify the one-time code with Supabase Auth.
export async function verifyOTP(data: OTPVerification): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = normalizeEmail(data.email);
  const { getSupabase } = await import('./supabase');
  const sb = getSupabase();
  if (!sb) {
    return { success: false, message: 'Database not configured' };
  }

  const { error } = await sb.auth.verifyOtp({
    email: normalizedEmail,
    token: data.otp.trim(),
    type: 'email',
  });
  if (error) {
    return { success: false, message: error.message };
  }

  const linked = await linkTenantToAuthUser(normalizedEmail);
  if (!linked) {
    // Verified, but not a tenant. Drop the session rather than leaving a
    // half-authenticated user holding a valid token.
    await sb.auth.signOut();
    return {
      success: false,
      message: 'Email verified, but no tenant profile is linked to this email. Contact your landlord first.',
    };
  }

  return { success: true, message: 'OTP verified successfully' };
}

export async function signOutStudent(): Promise<void> {
  const { getSupabase } = await import('./supabase');
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

export async function requestStudentPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  const { getSupabase } = await import('./supabase');
  const sb = getSupabase();
  if (!sb) return { success: false, message: 'Database not configured' };

  const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/?auth=student-reset`,
  });
  return error
    ? { success: false, message: error.message }
    : { success: true, message: 'Password reset instructions have been sent to your email.' };
}

export async function fetchAuthenticatedStudent(): Promise<AuthenticatedStudent | null> {
  const { getSupabase } = await import('./supabase');
  const sb = getSupabase();
  if (!sb) return null;

  const { data: authData, error: authError } = await sb.auth.getUser();
  const user = authData.user;
  if (authError || !user?.email) return null;

  const normalizedEmail = normalizeEmail(user.email);

  const byAuthId = user.id
    ? await sb
        .from('tenants')
        .select('id, full_name, email, phone, nrc, move_in_date, bed_space_id, profile_image_url')
        .eq('auth_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
    : { data: null, error: null };

  if (byAuthId.error) throw byAuthId.error;
  if (byAuthId.data) {
    return mapTenantRow(byAuthId.data, normalizedEmail);
  }

  const byEmail = await fetchTenantByEmail(normalizedEmail);
  if (!byEmail) return null;

  if (byEmail.auth_user_id !== user.id) {
    const { error: linkError } = await sb
      .from('tenants')
      .update({ auth_user_id: user.id })
      .eq('id', byEmail.id);
    if (linkError) throw linkError;
  }

  return mapTenantRow(byEmail, normalizedEmail);
}

type LandlordProfile = {
  id: string;
  role: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  bio: string | null;
};

/**
 * Resolves the landlord profile for the signed-in user.
 *
 * Prefers the `link_landlord_profile` RPC (migration 006), which also adopts a
 * pre-existing profile row whose `auth_user_id` was never populated. Falls back
 * to a direct lookup so the app keeps working before that migration is applied.
 */
async function resolveLandlordProfile(
  sb: import('@supabase/supabase-js').SupabaseClient,
  email: string,
): Promise<LandlordProfile | null> {
  const { data, error } = await sb.rpc('link_landlord_profile');
  if (!error) {
    const rows = (data ?? []) as Array<LandlordProfile & { profile_id: string }>;
    const row = rows[0];
    return row ? { ...row, id: row.profile_id } : null;
  }

  const { data: fallback, error: fallbackError } = await sb
    .from('profiles')
    .select('id, role, full_name, email, phone, address, bio')
    .eq('role', 'landlord')
    .ilike('email', email)
    .maybeSingle();
  if (fallbackError) throw fallbackError;
  return (fallback as LandlordProfile | null) ?? null;
}

export async function landlordLogin(credentials: LoginCredentials): Promise<{ success: boolean; user?: any; message: string }> {
  const email = normalizeEmail(credentials.email);
  const { getSupabase } = await import('./supabase');
  const sb = getSupabase();

  if (!sb) {
    // No backend configured. The seed fixtures contain no real data, so the
    // demo entry point deliberately has no password to leak.
    return DEMO_LOGIN_ENABLED
      ? {
          success: true,
          user: { email, name: 'Demo Landlord', role: 'Property Owner' },
          message: 'Signed in to the offline demo dataset',
        }
      : {
          success: false,
          message: 'Database not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
        };
  }

  const { data: authData, error: authError } = await sb.auth.signInWithPassword({
    email,
    password: credentials.password,
  });
  if (authError || !authData.user) {
    return { success: false, message: 'Invalid landlord email or password' };
  }

  let profile: LandlordProfile | null;
  try {
    profile = await resolveLandlordProfile(sb, email);
  } catch (error) {
    await sb.auth.signOut();
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Could not verify the landlord profile',
    };
  }

  if (!profile) {
    // Authenticated, but not a landlord. Drop the session so no elevated view
    // can be reached with it.
    await sb.auth.signOut();
    return {
      success: false,
      message: 'This account is not linked to a landlord profile. Contact the property owner.',
    };
  }

  return {
    success: true,
    user: {
      id: profile.id,
      name: profile.full_name,
      email: profile.email ?? authData.user.email,
      phone: profile.phone ?? '',
      address: profile.address ?? '',
      bio: profile.bio ?? '',
      role: 'Property Owner',
    },
    message: 'Login successful',
  };
}

// Student login (check if student exists in database)
export async function studentLogin(credentials: LoginCredentials): Promise<{ success: boolean; student?: AuthenticatedStudent; message: string }> {
  try {
    const { getSupabase } = await import('./supabase');
    const sb = getSupabase();

    if (!sb) {
      return { success: false, message: 'Database not configured' };
    }

    const normalizedEmail = normalizeEmail(credentials.email);
    const { data: authData, error: authError } = await sb.auth.signInWithPassword({
      email: normalizedEmail,
      password: credentials.password,
    });
    if (authError || !authData.user) {
      return { success: false, message: authError?.message === 'Invalid login credentials' ? 'Invalid email or password' : (authError?.message ?? 'Invalid email or password') };
    }

    const linked = await linkTenantToAuthUser(normalizedEmail);
    if (!linked) {
      await sb.auth.signOut();
      return {
        success: false,
        message: 'Your login worked, but no tenant profile is linked to this email. Ask your landlord to onboard you with this exact email first.',
      };
    }

    return { success: true, student: linked, message: 'Login successful' };
  } catch (error) {
    console.error('Student login error:', error);
    return { success: false, message: 'Login failed' };
  }
}

export async function changeStudentPassword(currentPassword: string, newPassword: string): Promise<void> {
  const { getSupabase } = await import('./supabase');
  const sb = getSupabase();
  if (!sb) throw new Error('Database not configured');
  const { data: session } = await sb.auth.getSession();
  const email = session.session?.user.email;
  if (!email) throw new Error('Your session has expired. Please log in again.');
  const { error: signInError } = await sb.auth.signInWithPassword({ email, password: currentPassword });
  if (signInError) throw new Error('Current password is incorrect.');
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
