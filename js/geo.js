// Lightweight geolocation + "can this promoter reach this event within an hour"
// matching. No paid maps/routing API involved — distance is straight-line
// (haversine) converted to an estimated travel time using an assumed average
// urban speed. This is an approximation, not real turn-by-turn routing, but is
// enough to power the "reachable within 1 hour" filter without adding a
// billing dependency on top of the ones already in play.

const ASSUMED_AVG_SPEED_KMH = 25; // conservative dense-urban-traffic estimate

export function getCurrentLocation({ timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation isn't supported by this browser."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(mapGeoError(err))),
      { timeout, enableHighAccuracy: false }
    );
  });
}

function mapGeoError(err) {
  if (err.code === err.PERMISSION_DENIED) return "Location access was denied. You can still use the platform, but nearby-gig matching won't be available.";
  if (err.code === err.TIMEOUT) return "Location request timed out. Please try again.";
  return "Couldn't get your location. Please try again.";
}

export function haversineDistanceKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(deg) { return (deg * Math.PI) / 180; }

export function estimateTravelMinutes(distanceKm) {
  if (distanceKm == null) return null;
  return Math.max(5, Math.round((distanceKm / ASSUMED_AVG_SPEED_KMH) * 60));
}

/** True when a promoter's saved location is estimated to be reachable within 60 minutes of an event's venue. */
export function isReachableWithinHour(promoterLoc, eventLoc) {
  const km = haversineDistanceKm(promoterLoc, eventLoc);
  if (km == null) return null; // unknown — one side has no coordinates saved
  return estimateTravelMinutes(km) <= 60;
}

export function distanceLabel(promoterLoc, eventLoc) {
  const km = haversineDistanceKm(promoterLoc, eventLoc);
  if (km == null) return null;
  const mins = estimateTravelMinutes(km);
  return `📍 ${km < 1 ? "<1" : km.toFixed(1)} km away · ~${mins} min travel`;
}
