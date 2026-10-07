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

export async function sendOTP(phone: string): Promise<{ success: boolean }> {
  const { error } = await getSupabaseClient().auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  });

  if (error) throw error;
  return { success: true };
}

export async function verifyOTP(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const { data, error } = await getSupabaseClient().auth.verifyOtp({
    phone,
    token: code,
    type: 'sms',
  });

  if (error) return { success: false, error: error.message };
  if (!data.user) {
    return { success: false, error: 'Supabase did not return an authenticated user.' };
  }

  return { success: true, userId: data.user.id };
}

export async function saveProfile(profile: {
  id: string;
  phone: string;
  name: string;
  role: User['role'];
  bicycleNumber?: string;
}): Promise<User> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .upsert(
      {
        id: profile.id,
        phone: profile.phone,
        full_name: profile.name,
        role: profile.role,
        bicycle_number: profile.bicycleNumber || null,
      },
      { onConflict: 'id' }
    )
    .select('id, phone, full_name, role, created_at')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    phone: data.phone,
    name: data.full_name,
    role: data.role,
    createdAt: data.created_at,
  };
}
