import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { PageContainer } from '../../components/ui/PageContainer';
import { Button } from '../../components/ui/Button';

export default function RoleScreen() {
  const [selectedRole, setSelectedRole] = useState<'passenger' | 'driver' | null>(null);
  const navigate = useNavigate();
  const setRole = useAuthStore(state => state.setRole);

  const handleContinue = () => {
    if (selectedRole) {
      setRole(selectedRole);
      navigate('/auth/profile');
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <PageContainer>
      <div className="mb-8 mt-4">
        <h1 className="text-3xl font-bold mb-2">How will you use Tugende?</h1>
        <p className="text-gray-500">You can change this later</p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="flex-1 flex flex-col gap-4"
      >
        <motion.button
          variants={item}
          onClick={() => setSelectedRole('passenger')}
          className={`flex flex-col items-center p-6 rounded-2xl border-2 transition-all text-left w-full ${selectedRole === 'passenger' ? 'border-sunset bg-sunset/5' : 'border-gray-200 bg-gray-50'}`}
        >
          <span className="text-5xl mb-4">🧑‍🤝‍🧑</span>
          <h3 className="text-xl font-bold mb-2 text-center">I'm a Passenger</h3>
          <p className="text-gray-500 text-center">Book rides and send parcels across Kigali</p>
        </motion.button>

        <motion.button
          variants={item}
          onClick={() => setSelectedRole('driver')}
          className={`flex flex-col items-center p-6 rounded-2xl border-2 transition-all text-left w-full ${selectedRole === 'driver' ? 'border-sunset bg-sunset/5' : 'border-gray-200 bg-gray-50'}`}
        >
          <span className="text-5xl mb-4">🚴</span>
          <h3 className="text-xl font-bold mb-2 text-center">I'm a Driver</h3>
          <p className="text-gray-500 text-center">Earn money by giving rides and delivering parcels</p>
        </motion.button>
      </motion.div>

      <div className="mt-8 pb-4">
        <Button
          fullWidth
          size="lg"
          onClick={handleContinue}
          disabled={!selectedRole}
        >
          Continue
        </Button>
      </div>
    </PageContainer>
  );
}
