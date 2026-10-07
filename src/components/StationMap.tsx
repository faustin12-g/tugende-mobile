import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet icons in Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const stations = [
  { id: 1, name: 'Nyarugenge Car-Free Zone', lat: -1.9441, lng: 30.0619, bikes: 5 },
  { id: 2, name: 'KBC Roundabout', lat: -1.9536, lng: 30.0933, bikes: 2 },
  { id: 3, name: 'Gishushu / KG 1 Ave', lat: -1.9545, lng: 30.1030, bikes: 8 },
];

export default function StationMap() {
  return (
    <MapContainer center={[-1.9441, 30.0619]} zoom={14} style={{ height: '65vh', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {stations.map(station => (
        <Marker key={station.id} position={[station.lat, station.lng]}>
          <Popup>
            <strong>{station.name}</strong><br/>
            Available Bikes: {station.bikes}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}//
//  StationMap.tsx
//  
//
//  Created by Learnlife Rwanda on 06/10/2026.
//

