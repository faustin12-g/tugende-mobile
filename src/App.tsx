import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import WelcomeScreen from './pages/Welcome/WelcomeScreen';
import AuthChoiceScreen from './pages/Auth/AuthChoiceScreen';
import EmailScreen from './pages/Auth/EmailScreen';
import OTPScreen from './pages/Auth/OTPScreen';
import RoleScreen from './pages/Auth/RoleScreen';
import ProfileScreen from './pages/Auth/ProfileScreen';
import PassengerHome from './pages/PassengerHome/PassengerHome';
import ParcelDeliveryScreen from './pages/PassengerHome/ParcelDeliveryScreen';
import DriverHome from './pages/DriverHome/DriverHome';
import PublicTrackingScreen from './pages/Tracking/PublicTrackingScreen';

function AppRoutes() {
  const { isAuthenticated, hasSeenOnboarding, user } = useAuthStore();
  const location = useLocation();

  if (location.pathname.startsWith('/track/')) {
    return (
      <Routes>
        <Route path="/track/:token" element={<PublicTrackingScreen />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  // Not seen onboarding yet → show welcome slides
  if (!hasSeenOnboarding) {
    return (
      <Routes>
        <Route path="*" element={<WelcomeScreen />} />
      </Routes>
    );
  }

  // Not authenticated → show auth flow
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthChoiceScreen />} />
        <Route path="/auth/email" element={<EmailScreen />} />
        <Route path="/auth/otp" element={<OTPScreen />} />
        <Route path="/auth/role" element={<RoleScreen />} />
        <Route path="/auth/profile" element={<ProfileScreen />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  // Authenticated → role-specific home
  return (
    <Routes>
      <Route
        path="/home"
        element={
          user?.role === 'driver' ? <DriverHome /> : <PassengerHome />
        }
      />
      {user?.role === 'passenger' && (
        <Route path="/parcels/new" element={<ParcelDeliveryScreen />} />
      )}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
