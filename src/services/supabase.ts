import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Dummy OTP verification for development.
 * In production, this will use Supabase Auth with Twilio.
 */
export const DEV_OTP_CODE = '123456';

export async function sendOTP(phone: string): Promise<{ success: boolean }> {
  console.log(`[DEV] OTP sent to ${phone}: ${DEV_OTP_CODE}`);
  // In production: await supabase.auth.signInWithOtp({ phone })
  return { success: true };
}

export async function verifyOTP(
  _phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  // In production: await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })
  if (code === DEV_OTP_CODE) {
    return { success: true };
  }
  return { success: false, error: 'Invalid OTP code' };
}
