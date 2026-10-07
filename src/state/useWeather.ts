import { useEffect, useState } from 'react';
import { fetchWeather, type Weather } from '../services/weather';

export function useWeather(): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetchWeather().then((w) => alive && setWeather(w)).catch(() => undefined);
    load();
    const id = window.setInterval(load, 15 * 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);
  return weather;
}
