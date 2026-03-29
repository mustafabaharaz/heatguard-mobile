import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export function useLocation() {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          setError('Location permission denied');
          setLocation({ lat: 33.4255, lon: -111.9400 });
          setLoading(false);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation({
          lat: currentLocation.coords.latitude,
          lon: currentLocation.coords.longitude,
        });
        setLoading(false);
      } catch (err) {
        setError('Failed to get location');
        setLocation({ lat: 33.4255, lon: -111.9400 });
        setLoading(false);
      }
    })();
  }, []);

  return { location, error, loading };
}
