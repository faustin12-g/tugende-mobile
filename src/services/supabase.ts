import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.');
  }

  client ??= createClient(supabaseUrl, supabaseAnonKey);
  return client;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function sendOTP(email: string, shouldCreateUser = false): Promise<{ success: boolean }> {
  const { error } = await getSupabaseClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser },
  });

  if (error) throw error;
  return { success: true };
}

export async function getCurrentProfile(): Promise<User | null> {
  const { data: { user: authUser }, error: authError } = await getSupabaseClient().auth.getUser();
  if (authError) throw authError;
  if (!authUser) return null;

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id, email, phone, full_name, role, created_at')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    email: data.email ?? undefined,
    phone: data.phone,
    name: data.full_name,
    role: data.role,
    createdAt: data.created_at,
  };
}

export async function verifyOTP(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const auth = getSupabaseClient().auth;
  let lastError: Error | null = null;

  for (const type of ['signup', 'email'] as const) {
    const { data, error } = await auth.verifyOtp({ email, token: code, type });
    if (error) {
      lastError = error;
      continue;
    }
    if (!data.user) {
      return { success: false, error: 'Supabase did not return an authenticated user.' };
    }

    return { success: true, userId: data.user.id };
  }

  return { success: false, error: lastError?.message ?? 'Could not verify the code.' };
}

export async function saveProfile(profile: {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  bicycleNumber?: string;
}): Promise<User> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .upsert(
      {
        id: profile.id,
        email: profile.email,
        full_name: profile.name,
        role: profile.role,
        bicycle_number: profile.bicycleNumber || null,
      },
      { onConflict: 'id' }
    )
    .select('id, email, phone, full_name, role, created_at')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    email: data.email ?? undefined,
    phone: data.phone,
    name: data.full_name,
    role: data.role,
    createdAt: data.created_at,
  };
}
