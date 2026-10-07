import { useState } from 'react';
import { PageContainer } from '../../components/ui/PageContainer';

export default function DriverHome() {
  const [isOnline, setIsOnline] = useState(false);

  return (
    <PageContainer withPadding={false} className="relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-white/80 backdrop-blur-md">
        <h1 className="text-xl font-bold text-black tracking-tight">Tugende Driver</h1>
        
        {/* Online Toggle */}
        <button 
          onClick={() => setIsOnline(!isOnline)}
          className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${isOnline ? 'bg-sunset' : 'bg-gray-300'}`}
        >
          <span 
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isOnline ? 'translate-x-9' : 'translate-x-1'}`}
          />
        </button>
      </div>

      {/* Map Placeholder */}
      <div className="flex-1 bg-gray-100 flex items-center justify-center">
        <p className="text-gray-400 font-medium">Map will go here</p>
      </div>

      {/* Bottom Section */}
      <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] p-6 pb-12 flex flex-col items-center justify-center gap-4 min-h-[200px]">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full absolute top-4" />
        
        {isOnline ? (
          <>
            <div className="text-4xl animate-bounce mt-4">🚲</div>
            <p className="text-gray-500 font-medium text-center">Nearby ride requests will appear here</p>
          </>
        ) : (
          <>
            <div className="text-4xl grayscale opacity-50 mt-4">🚲</div>
            <p className="text-gray-500 font-medium text-center">Go online to receive ride requests</p>
          </>
        )}
      </div>
    </PageContainer>
  );
}
