import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { sendOTP } from '../../services/supabase';
import { PageContainer } from '../../components/ui/PageContainer';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function PhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setPhone = useAuthStore(state => state.setPhone);

  const handleSubmit = async () => {
    if (phoneNumber.length >= 9) {
      setLoading(true);
      setError('');
      const phone = `+250${phoneNumber}`;
      try {
        await sendOTP(phone);
        setPhone(phone);
        navigate('/auth/otp');
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Could not send the verification code.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <PageContainer>
      <div className="mb-8 mt-4 flex items-center">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
      </div>
      
      <div className="flex-1">
        <h1 className="text-3xl font-bold mb-2">Enter your phone number</h1>
        <p className="text-gray-500 mb-8">We'll send you a verification code</p>

        <Input
          type="tel"
          inputMode="numeric"
          prefix="+250"
          placeholder="7XXXXXXXX"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
          autoFocus
        />
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-auto pb-4">
        <Button
          fullWidth
          size="lg"
          onClick={handleSubmit}
          disabled={phoneNumber.length < 9}
          loading={loading}
        >
          Continue
        </Button>
      </div>
    </PageContainer>
  );
}
