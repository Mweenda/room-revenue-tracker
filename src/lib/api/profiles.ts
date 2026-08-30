import { getSupabase } from "../supabase";

export interface LandlordProfileInput {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  bio: string;
}

export async function updateLandlordProfile(input: LandlordProfileInput) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");
  const { data: authUser } = await sb.auth.getUser();
  const previousEmail = authUser.user?.email?.trim().toLowerCase();
  const { data, error } = await sb
    .from("profiles")
    .upsert({
      id: input.id,
      role: "landlord",
      full_name: input.name,
      email: input.email,
      phone: input.phone || null,
      address: input.address || null,
      bio: input.bio || null,
      updated_at: new Date().toISOString(),
    })
    .select("id, role, full_name, email, phone, address, bio")
    .single();
  if (error) throw error;
  if (previousEmail && input.email.trim().toLowerCase() !== previousEmail) {
    const { error: authError } = await sb.auth.updateUser({ email: input.email.trim().toLowerCase() });
    if (authError) throw authError;
  }
  return {
    id: data.id,
    name: data.full_name,
    email: data.email ?? "",
    phone: data.phone ?? "",
    address: data.address ?? "",
    bio: data.bio ?? "",
    role: "Property Owner",
  };
}