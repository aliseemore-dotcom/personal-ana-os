import { config } from '../config';

export interface Weather {
  temperatureC: number;
  summary: string;
}

const CODES: [number[], string][] = [
  [[0], 'Clear'],
  [[1], 'Mostly clear'],
  [[2], 'Partly cloudy'],
  [[3], 'Overcast'],
  [[45, 48], 'Fog'],
  [[51, 53, 55, 56, 57], 'Drizzle'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain'],
  [[71, 73, 75, 77, 85, 86], 'Snow'],
  [[95, 96, 99], 'Thunderstorm'],
];

export const describeWeatherCode = (code: number) => CODES.find(([c]) => c.includes(code))?.[1] ?? 'Mild';

function position(): Promise<{ lat: number; lon: number }> {
  const fallback = { lat: config.weather.lat, lon: config.weather.lon };
  if (!('geolocation' in navigator)) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(fallback),
      { timeout: 4000, maximumAge: 3_600_000 },
    );
  });
}

/** Open-Meteo: free, no API key. */
export async function fetchWeather(): Promise<Weather> {
  const { lat, lon } = await position();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather responded ${res.status}`);
  const body = (await res.json()) as { current: { temperature_2m: number; weather_code: number } };
  return {
    temperatureC: Math.round(body.current.temperature_2m),
    summary: describeWeatherCode(body.current.weather_code),
  };
}
