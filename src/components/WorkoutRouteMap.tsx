import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { StoredGpxRoute } from '@/lib/gpxRoute';

type Props = { route: StoredGpxRoute };

export const WorkoutRouteMap: React.FC<Props> = ({ route }) => {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const map = L.map(host.current, { zoomControl: false, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const coordinates = route.points.map((point) => L.latLng(point.latitude, point.longitude));
    L.polyline(coordinates, { color: '#ffffff', weight: 11, opacity: 0.96, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    const line = L.polyline(coordinates, { color: '#087ea4', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    const start = coordinates[0];
    const finish = coordinates[coordinates.length - 1];
    L.circleMarker(start, { radius: 7, color: '#fff', weight: 3, fillColor: '#00a878', fillOpacity: 1 }).addTo(map);
    L.circleMarker(finish, { radius: 7, color: '#fff', weight: 3, fillColor: '#ef476f', fillOpacity: 1 }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [24, 24], maxZoom: 16 });
    window.setTimeout(() => map.invalidateSize(), 50);
    return () => { map.remove(); };
  }, [route]);

  return <div ref={host} className="workout-route-map" role="img" aria-label={`Run route map with ${route.points.length.toLocaleString()} GPS points`} />;
};
