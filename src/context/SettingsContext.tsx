import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useDeviceColorScheme } from 'react-native';

type TempUnit = 'celsius' | 'fahrenheit';
type AppTheme = 'system' | 'light' | 'dark';

interface SettingsContextType {
  tempUnit: TempUnit;
  setTempUnit: (u: TempUnit) => void;
  appTheme: AppTheme;
  setAppTheme: (t: AppTheme) => void;
  isDark: boolean;
  formatTemp: (celsius: number, showUnit?: boolean) => string;
}

const SettingsContext = createContext<SettingsContextType>({
  tempUnit: 'fahrenheit',
  setTempUnit: () => {},
  appTheme: 'system',
  setAppTheme: () => {},
  isDark: false,
  formatTemp: (c) => `${c}°`,
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deviceScheme = useDeviceColorScheme();
  const [tempUnit, setTempUnitState] = useState<TempUnit>('fahrenheit');
  const [appTheme, setAppThemeState] = useState<AppTheme>('system');

  useEffect(() => {
    AsyncStorage.multiGet(['@heatguard/temp_unit', '@heatguard/app_theme']).then((pairs) => {
      const unit = pairs[0][1] as TempUnit | null;
      const theme = pairs[1][1] as AppTheme | null;
      if (unit) setTempUnitState(unit);
      if (theme) setAppThemeState(theme);
    }).catch(() => {});
  }, []);

  const setTempUnit = (u: TempUnit) => {
    setTempUnitState(u);
    AsyncStorage.setItem('@heatguard/temp_unit', u).catch(() => {});
  };

  const setAppTheme = (t: AppTheme) => {
    setAppThemeState(t);
    AsyncStorage.setItem('@heatguard/app_theme', t).catch(() => {});
  };

  const isDark =
    appTheme === 'dark' || (appTheme === 'system' && deviceScheme === 'dark');

  const formatTemp = (celsius: number, showUnit = true): string => {
    if (tempUnit === 'fahrenheit') {
      const f = Math.round(celsius * 9 / 5 + 32);
      return showUnit ? `${f}°F` : `${f}°`;
    }
    return showUnit ? `${Math.round(celsius)}°C` : `${Math.round(celsius)}°`;
  };

  return (
    <SettingsContext.Provider value={{ tempUnit, setTempUnit, appTheme, setAppTheme, isDark, formatTemp }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
