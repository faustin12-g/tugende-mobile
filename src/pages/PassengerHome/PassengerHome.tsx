// PassengerHome placeholder
import { PageContainer } from '../../components/ui/PageContainer';
import { Button } from '../../components/ui/Button';

export default function PassengerHome() {
  return (
    <PageContainer withPadding={false} className="relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-white/80 backdrop-blur-md">
        <h1 className="text-2xl font-bold text-black tracking-tight">Tugende</h1>
        <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
           <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="flex-1 bg-gray-100 flex items-center justify-center">
        <p className="text-gray-400 font-medium">Map will go here</p>
      </div>

      {/* Bottom Sheet */}
      <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] p-6 pb-8 space-y-6">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-2 mb-2" />
        
        <div className="bg-gray-100 p-4 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <span className="text-gray-500 font-medium">Where to?</span>
        </div>

        <div className="flex gap-4">
          <Button variant="outline" fullWidth className="py-4">
            <span className="mr-2">🚲</span> Book a Ride
          </Button>
          <Button variant="outline" fullWidth className="py-4">
            <span className="mr-2">📦</span> Send Parcel
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
