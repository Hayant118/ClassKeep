import { createContext, useContext, useEffect, useState } from 'react';
import type { CalendarPreferences } from '../types';
import { getPreferences, savePreferences } from '../storage';

interface PreferencesContextValue {
  preferences: CalendarPreferences;
  setPreferences: (preferences: CalendarPreferences) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferencesState] = useState<CalendarPreferences>(() => getPreferences());

  const setPreferences = (next: CalendarPreferences) => {
    savePreferences(next);
    setPreferencesState(next);
  };

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'classkeep_preferences') {
        setPreferencesState(getPreferences());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, setPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return ctx;
}
