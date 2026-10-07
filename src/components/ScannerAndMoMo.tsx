import { useState } from 'react';

export default function ScannerAndMoMo() {
  const [bikeCode, setBikeCode] = useState('');
  const [phone, setPhone] = useState('+250');
  const [status, setStatus] = useState('IDLE'); // IDLE, SCANNING, PAYING, SUCCESS

  const handleManualScan = () => {
    if (bikeCode) setStatus('PAYING');
  };

  const handleMoMoPayment = () => {
    // Simulate MTN MoMo USSD push latency
    setStatus('PROCESSING');
    setTimeout(() => {
      setStatus('SUCCESS');
    }, 2000);
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>
      {status === 'IDLE' && (
        <div>
          <button style={{ padding: '12px 24px', fontSize: '16px', marginBottom: '15px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '8px' }} onClick={() => setStatus('SCANNING')}>
            Scan QR Code (Requires iPhone)
          </button>
          <p style={{ fontSize: '14px', color: '#666' }}>Web Testing Fallback:</p>
          <input
            value={bikeCode}
            onChange={(e) => setBikeCode(e.target.value)}
            placeholder="e.g., BIKE-042"
            style={{ padding: '8px', marginRight: '10px' }}
          />
          <button onClick={handleManualScan} style={{ padding: '8px 16px' }}>Unlock</button>
        </div>
      )}

      {status === 'PAYING' && (
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px', backgroundColor: '#fff' }}>
          <h3>Confirm MoMo Payment</h3>
          <p>Bike: <strong>{bikeCode}</strong> | Rate: 200 RWF</p>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+250 78..."
            style={{ width: '80%', padding: '10px', marginBottom: '15px', fontSize: '16px' }}
          />
          <br/>
          <button onClick={handleMoMoPayment} style={{ backgroundColor: '#ffcc00', color: '#000', padding: '12px 24px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px' }}>
            Pay with MTN MoMo
          </button>
        </div>
      )}

      {status === 'PROCESSING' && (
        <p style={{ color: '#0056b3', fontWeight: 'bold' }}>Awaiting USSD confirmation on your phone...</p>
      )}
      
      {status === 'SUCCESS' && (
        <h3 style={{ color: '#28a745' }}>Bike Unlocked! Trip Started.</h3>
      )}
    </div>
  );
}//
//  ScannerAndMoMo.tsx
//  
//
//  Created by Learnlife Rwanda on 06/10/2026.
//

