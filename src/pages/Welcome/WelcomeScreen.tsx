import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { PageContainer } from '../../components/ui/PageContainer';
import { Button } from '../../components/ui/Button';

const slides = [
  {
    id: 1,
    icon: '🚲',
    title: 'Book a Ride Instantly',
    description: 'Connect with nearby bicycle riders in Kigali. Affordable, fast, and eco-friendly.'
  },
  {
    id: 2,
    icon: '📦',
    title: 'Send Parcels Across Kigali',
    description: 'Need to send something? Our riders will pick up and deliver your parcel safely.'
  },
  {
    id: 3,
    icon: '💰',
    title: 'Earn on Your Bicycle',
    description: 'Turn your bicycle into an income source. Accept rides, deliver parcels, grow your earnings.'
  }
];

export default function WelcomeScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const completeOnboarding = useAuthStore(state => state.completeOnboarding);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      handleDone();
    }
  };

  const handleDone = () => {
    completeOnboarding();
    navigate('/auth/phone');
  };

  return (
    <PageContainer className="justify-between items-center text-center pt-16">
      <div className="flex-1 flex flex-col justify-center items-center w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            <div className="w-48 h-48 rounded-full bg-sunset/20 flex items-center justify-center mb-8 relative">
              <span className="text-7xl">{slides[currentSlide].icon}</span>
            </div>
            <h1 className="text-3xl font-bold mb-4">{slides[currentSlide].title}</h1>
            <p className="text-gray-500 text-lg px-4">{slides[currentSlide].description}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="w-full flex flex-col items-center pb-8 gap-6">
        <div className="flex gap-2">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-6 bg-sunset' : 'w-2 bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="w-full space-y-4">
          <Button fullWidth size="lg" onClick={handleNext}>
            {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
          </Button>
          {currentSlide < slides.length - 1 && (
            <Button variant="ghost" fullWidth onClick={handleDone}>
              Skip
            </Button>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
