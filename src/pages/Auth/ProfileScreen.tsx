import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { PageContainer } from '../../components/ui/PageContainer';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [bikeNumber, setBikeNumber] = useState('');
  
  const navigate = useNavigate();
  const { role, phone, completeAuth, setBicycleNumber } = useAuthStore();

  const handleSubmit = () => {
    if (name && (role !== 'driver' || bikeNumber)) {
      if (role === 'driver') {
        setBicycleNumber(bikeNumber);
      }
      
      const user = {
        id: crypto.randomUUID(),
        phone,
        name,
        role: role as 'passenger' | 'driver',
        createdAt: new Date().toISOString(),
      };
      
      completeAuth(user);
      navigate('/home');
    }
  };

  const isFormValid = name.trim().length > 0 && (role !== 'driver' || bikeNumber.trim().length > 0);

  return (
    <PageContainer>
      <div className="mb-8 mt-4">
        <h1 className="text-3xl font-bold mb-2">Set up your profile</h1>
        <p className="text-gray-500">Tell us about yourself</p>
      </div>

      <div className="flex-1 flex flex-col items-center w-full gap-6">
        <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mb-4 relative overflow-hidden">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </div>

        <Input
          label="Full Name"
          placeholder="John Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {role === 'driver' && (
          <Input
            label="Bicycle Registration Number"
            placeholder="e.g. KGL 123"
            value={bikeNumber}
            onChange={(e) => setBikeNumber(e.target.value)}
          />
        )}
      </div>

      <div className="mt-auto pb-4">
        <Button
          fullWidth
          size="lg"
          onClick={handleSubmit}
          disabled={!isFormValid}
        >
          Complete Setup
        </Button>
      </div>
    </PageContainer>
  );
}
