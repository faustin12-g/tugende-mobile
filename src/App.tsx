import StationMap from './components/StationMap';
import ScannerAndMoMo from './components/ScannerAndMoMo';

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '500px', margin: '0 auto', border: '1px solid #eee', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ backgroundColor: '#000', color: '#fff', padding: '15px', textAlign: 'center', margin: 0 }}>
        <h2 style={{ margin: 0 }}>Igare Kigali</h2>
      </header>
      
      {/* Map takes up top section */}
      <StationMap />
      
      {/* Scanner & Payment anchors the bottom */}
      <div style={{ flexGrow: 1 }}>
        <ScannerAndMoMo />
      </div>
    </div>
  );
}
