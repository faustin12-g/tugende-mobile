import { LogIn, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { PageContainer } from '../../components/ui/PageContainer';
import { useAuthStore } from '../../store/authStore';

export default function AuthChoiceScreen() {
  const navigate = useNavigate();
  const setAuthMode = useAuthStore((state) => state.setAuthMode);

  const chooseMode = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    navigate('/auth/email');
  };

  return (
    <PageContainer className="justify-between">
      <div className="mt-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-black">Welcome to Tugende</h1>
        <p className="mt-2 text-base text-gray-600">Choose how to continue</p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-4">
        <Button fullWidth size="lg" onClick={() => chooseMode('login')} className="min-h-14">
          <LogIn aria-hidden="true" className="mr-2 h-5 w-5" />
          Log in
        </Button>
        <Button
          fullWidth
          size="lg"
          variant="outline"
          onClick={() => chooseMode('signup')}
          className="min-h-14"
        >
          <UserPlus aria-hidden="true" className="mr-2 h-5 w-5" />
          Sign up
        </Button>
      </div>
    </PageContainer>
  );
}
