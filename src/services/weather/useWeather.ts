// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · useWeather hook
// Subscribes a component to the shared weather store and triggers a refresh
// if the data is missing or stale. Safe to use in many screens at once.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useReducer } from 'react';
import {
  getWeatherState,
  refreshWeather,
  subscribeWeather,
  type WeatherSnapshot,
} from './weatherStore';

export interface UseWeatherResult {
  snapshot: WeatherSnapshot | null;
  /** Current air temperature °F, or null if weather has never loaded. */
  tempF: number | null;
  /** Current feels-like temperature °F, or null. */
  feelsLikeF: number | null;
  loading: boolean;
  error: string | null;
}

export function useWeather(): UseWeatherResult {
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const unsubscribe = subscribeWeather(rerender);
    refreshWeather();
    return unsubscribe;
  }, []);

  const { snapshot, loading, error } = getWeatherState();
  return {
    snapshot,
    tempF: snapshot ? Math.round(snapshot.current.tempF) : null,
    feelsLikeF: snapshot ? Math.round(snapshot.current.feelsLikeF) : null,
    loading,
    error,
  };
}
