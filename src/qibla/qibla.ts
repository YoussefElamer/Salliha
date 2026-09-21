const KAABA_LAT = 21.422487;
const KAABA_LON = 39.826206;

export function calculateQibla(latitude: number, longitude: number): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const toDeg = (value: number) => value * 180 / Math.PI;
  const lat1 = toRad(latitude);
  const lat2 = toRad(KAABA_LAT);
  const deltaLon = toRad(KAABA_LON - longitude);
  const bearing = toDeg(Math.atan2(
    Math.sin(deltaLon),
    Math.cos(lat1) * Math.tan(lat2) - Math.sin(lat1) * Math.cos(deltaLon)
  ));
  return (bearing + 360) % 360;
}

export function directionLabel(degrees: number): string {
  if (degrees >= 337.5 || degrees < 22.5) return 'شمال';
  if (degrees < 67.5) return 'شمال شرقي';
  if (degrees < 112.5) return 'شرق';
  if (degrees < 157.5) return 'جنوب شرقي';
  if (degrees < 202.5) return 'جنوب';
  if (degrees < 247.5) return 'جنوب غربي';
  if (degrees < 292.5) return 'غرب';
  return 'شمال غربي';
}

export function normalizeHeading(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}
