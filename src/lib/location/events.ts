export const LOCATION_CHANGED_EVENT = "rs:location-changed";

export function dispatchLocationChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LOCATION_CHANGED_EVENT));
}

export function onLocationChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LOCATION_CHANGED_EVENT, handler);
  return () => window.removeEventListener(LOCATION_CHANGED_EVENT, handler);
}
