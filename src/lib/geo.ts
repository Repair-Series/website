export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function parseCoord(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "object" && value !== null && "latitude" in value) {
    const n = Number((value as { latitude: unknown }).latitude);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseCoordLng(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "object" && value !== null && "longitude" in value) {
    const n = Number((value as { longitude: unknown }).longitude);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function getBookingLatLng(bookingLike: Record<string, unknown> | null | undefined) {
  if (!bookingLike) return { lat: null as number | null, lng: null as number | null };
  let lat = parseCoord(bookingLike.latitude);
  let lng = parseCoordLng(bookingLike.longitude);
  if (lat != null && lng != null) return { lat, lng };
  const addr = bookingLike.address;
  if (addr && typeof addr === "object" && !Array.isArray(addr)) {
    lat = parseCoord((addr as Record<string, unknown>).lat);
    lng = parseCoordLng((addr as Record<string, unknown>).lng);
    if (lat != null && lng != null) return { lat, lng };
  }
  return { lat: null, lng: null };
}

export function getTechnicianLatLng(technician: Record<string, unknown> | null | undefined) {
  if (!technician) return { lat: null as number | null, lng: null as number | null };
  const loc = technician.location;
  if (loc && typeof loc === "object" && !Array.isArray(loc)) {
    const o = loc as Record<string, unknown>;
    const latRaw = o.lat ?? o.latitude;
    const lngRaw = o.lng ?? o.longitude;
    const lat = latRaw != null && latRaw !== "" ? Number(latRaw) : null;
    const lng = lngRaw != null && lngRaw !== "" ? Number(lngRaw) : null;
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  const rootLat = parseCoord(technician.lat);
  const rootLng = parseCoordLng(technician.lng);
  if (rootLat != null && rootLng != null) return { lat: rootLat, lng: rootLng };
  const lat = parseCoord(technician.latitude);
  const lng = parseCoordLng(technician.longitude);
  if (lat != null && lng != null) return { lat, lng };
  return { lat: null, lng: null };
}
