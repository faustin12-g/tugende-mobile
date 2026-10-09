import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { sendOTP } from '../../services/supabase';
import { PageContainer } from '../../components/ui/PageContainer';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function EmailScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { authMode, setEmail: setStoredEmail } = useAuthStore();

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail) {
      setLoading(true);
      setError('');
      try {
        await sendOTP(normalizedEmail, authMode === 'signup');
        setStoredEmail(normalizedEmail);
        navigate('/auth/otp');
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Could not send the verification email.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <PageContainer>
      <div className="mb-8 mt-4 flex items-center">
        <button onClick={() => navigate('/auth')} className="p-2 -ml-2 rounded-full hover:bg-gray-100" aria-label="Back">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
      </div>
      
      <div className="flex-1">
        <h1 className="text-3xl font-bold mb-2">
          {authMode === 'signup' ? 'Create your account' : 'Log in'}
        </h1>
        <p className="text-gray-500 mb-8">
          {authMode === 'signup' ? 'Enter your email to get started' : 'Enter your email to continue'}
        </p>

        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-auto pb-4 space-y-3">
        <Button
          fullWidth
          size="lg"
          onClick={handleSubmit}
          disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
          loading={loading}
        >
          Continue
        </Button>
      </div>
    </PageContainer>
  );
}
