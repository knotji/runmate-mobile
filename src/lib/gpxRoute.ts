export type GpxRoutePoint = {
  latitude: number;
  longitude: number;
  elevationMeters?: number;
  at?: string;
  heartRate?: number;
  cadence?: number;
};

export type StoredGpxRoute = {
  fileName: string;
  importedAt: string;
  startTime: string | null;
  endTime: string | null;
  distanceKm: number;
  points: GpxRoutePoint[];
};

const STORAGE_PREFIX = 'runmate:gpx-route:';
const MAX_POINTS = 12_000;

export function parseGpx(text: string, fileName: string): StoredGpxRoute {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('This GPX file could not be read.');
  const nodes = [...xml.getElementsByTagNameNS('*', 'trkpt')];
  if (nodes.length < 2) throw new Error('This GPX file does not contain a usable track.');
  if (nodes.length > MAX_POINTS) throw new Error(`This route has more than ${MAX_POINTS.toLocaleString()} points and is too large to import safely.`);

  const points = nodes.map((node) => {
    const latitude = Number(node.getAttribute('lat'));
    const longitude = Number(node.getAttribute('lon'));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('This GPX file contains an invalid coordinate.');
    const elevationMeters = childNumber(node, 'ele');
    const at = childText(node, 'time');
    const heartRate = descendantNumber(node, 'hr');
    const cadence = descendantNumber(node, 'cad');
    return {
      latitude,
      longitude,
      ...(elevationMeters !== null ? { elevationMeters } : {}),
      ...(at ? { at } : {}),
      ...(heartRate !== null ? { heartRate } : {}),
      ...(cadence !== null ? { cadence } : {}),
    };
  });

  return {
    fileName,
    importedAt: new Date().toISOString(),
    startTime: points.find((point) => point.at)?.at ?? null,
    endTime: [...points].reverse().find((point) => point.at)?.at ?? null,
    distanceKm: Math.round(routeDistanceMeters(points) / 10) / 100,
    points,
  };
}

export function routeMatchesWorkout(route: StoredGpxRoute, workoutStart: string | null, toleranceMinutes = 10): boolean {
  if (!route.startTime || !workoutStart) return true;
  return Math.abs(Date.parse(route.startTime) - Date.parse(workoutStart)) <= toleranceMinutes * 60_000;
}

export function saveGpxRoute(workoutId: string, route: StoredGpxRoute): void {
  localStorage.setItem(`${STORAGE_PREFIX}${workoutId}`, JSON.stringify(route));
}

export function loadGpxRoute(workoutId: string): StoredGpxRoute | null {
  const value = localStorage.getItem(`${STORAGE_PREFIX}${workoutId}`);
  if (!value) return null;
  try {
    const route = JSON.parse(value) as StoredGpxRoute;
    return Array.isArray(route.points) && route.points.length >= 2 ? route : null;
  } catch {
    return null;
  }
}

export function removeGpxRoute(workoutId: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${workoutId}`);
}

function childText(node: Element, localName: string): string | null {
  const child = [...node.children].find((candidate) => candidate.localName === localName);
  return child?.textContent?.trim() || null;
}

function childNumber(node: Element, localName: string): number | null {
  const text = childText(node, localName);
  if (text === null) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function descendantNumber(node: Element, localName: string): number | null {
  const child = [...node.getElementsByTagNameNS('*', localName)][0];
  const text = child?.textContent?.trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function routeDistanceMeters(points: GpxRoutePoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += haversineMeters(points[index - 1], points[index]);
  return total;
}

function haversineMeters(a: GpxRoutePoint, b: GpxRoutePoint): number {
  const radians = Math.PI / 180;
  const lat1 = a.latitude * radians;
  const lat2 = b.latitude * radians;
  const deltaLat = lat2 - lat1;
  const deltaLon = (b.longitude - a.longitude) * radians;
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
