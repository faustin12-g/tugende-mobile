import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { sendOTP, verifyOTP } from '../../services/supabase';
import { PageContainer } from '../../components/ui/PageContainer';
import { Button } from '../../components/ui/Button';
import { OTPInput } from '../../components/ui/OTPInput';

export default function OTPScreen() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [resending, setResending] = useState(false);
  
  const navigate = useNavigate();
  const phone = useAuthStore(state => state.phone);
  const setStoreOtp = useAuthStore(state => state.setOtp);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async () => {
    if (otp.length === 6) {
      setLoading(true);
      setError('');
      try {
        const res = await verifyOTP(phone, otp);
        if (res.success) {
          setStoreOtp(otp);
          navigate('/auth/role');
        } else {
          setError(res.error || 'Invalid code');
        }
      } catch (verificationError) {
        setError(verificationError instanceof Error ? verificationError.message : 'Verification failed.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await sendOTP(phone);
      setCountdown(30);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not resend the verification code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <PageContainer>
      <div className="mb-8 mt-4 flex items-center">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
      </div>
      
      <div className="flex-1 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-2 self-start">Verify your number</h1>
        <p className="text-gray-500 mb-8 self-start">Enter the 6-digit code sent to {phone}</p>

        <OTPInput value={otp} onChange={setOtp} error={error} />
        <div className="mt-8 text-center">
          {countdown > 0 ? (
            <p className="text-gray-500">Resend code in {countdown}s</p>
          ) : (
            <button className="text-sunset font-semibold disabled:opacity-50" onClick={handleResend} disabled={resending}>
              {resending ? 'Sending...' : 'Resend code'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-auto pb-4">
        <Button
          fullWidth
          size="lg"
          onClick={handleVerify}
          disabled={otp.length < 6}
          loading={loading}
        >
          Verify
        </Button>
      </div>
    </PageContainer>
  );
}
