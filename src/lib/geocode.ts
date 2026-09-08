const memoryCache = new Map<string, { lat: number; lng: number }>();

function cacheKey(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

async function geocodeGoogle(address: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(data.error_message || `Google Geocoding: ${data.status || "error"}`);
  }
  if (!data.results?.length) throw new Error("Address not found.");
  const loc = data.results[0].geometry.location;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Invalid coordinates from geocoder.");
  }
  return { lat, lng };
}

async function geocodeNominatim(address: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status}).`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error("Address not found.");
  const lat = Number.parseFloat(data[0].lat);
  const lng = Number.parseFloat(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Invalid coordinates from geocoder.");
  }
  return { lat, lng };
}

export async function geocodeAddressString(addressText: string) {
  const q = addressText.trim();
  if (!q) throw new Error("Cannot geocode an empty address.");
  const key = cacheKey(q);
  if (memoryCache.has(key)) return memoryCache.get(key)!;
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY;
  const result = googleKey
    ? await geocodeGoogle(q, googleKey)
    : await geocodeNominatim(q);
  memoryCache.set(key, result);
  return result;
}

export async function reverseGeocode(lat: number, lng: number) {
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY;
  if (googleKey) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results?.[0]) {
      return parseAddressComponents(data.results[0]);
    }
  }
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const data = await res.json();
  const addr = data.address ?? {};
  return {
    street: [addr.house_number, addr.road].filter(Boolean).join(" "),
    area: addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? "",
    city: addr.city ?? addr.town ?? addr.village ?? addr.county ?? "",
    state: addr.state ?? "",
    pincode: addr.postcode ?? "",
    fullAddress: data.display_name ?? "",
  };
}

function parseAddressComponents(result: {
  formatted_address?: string;
  address_components?: Array<{ long_name: string; types: string[] }>;
}) {
  const parts = result.address_components ?? [];
  const get = (type: string) =>
    parts.find((p) => p.types.includes(type))?.long_name ?? "";
  return {
    street: [get("street_number"), get("route")].filter(Boolean).join(" "),
    area: get("sublocality") || get("neighborhood") || get("locality"),
    city: get("locality") || get("administrative_area_level_2"),
    state: get("administrative_area_level_1"),
    pincode: get("postal_code"),
    fullAddress: result.formatted_address ?? "",
  };
}
