import React, { createContext, useContext, useState, useCallback } from 'react';

interface NavigationContextType {
  navigateToVolume: (code: string, name: string) => void;
  navigateToVolatility: (code: string, name: string) => void;
  navigateToSectorVolume: (code: string, name: string) => void;
}

const NavigationContext = createContext<NavigationContextType>({
  navigateToVolume: () => {},
  navigateToVolatility: () => {},
  navigateToSectorVolume: () => {}
});

export const useNavigation = () => useContext(NavigationContext);

export const NavigationProvider: React.FC<{
  children: React.ReactNode;
  onNavigate: (tab: 'volume' | 'volatility' | 'sector-volume', code: string, name: string) => void;
}> = ({ children, onNavigate }) => {
  const navigateToVolume = useCallback((code: string, name: string) => {
    onNavigate('volume', code, name);
  }, [onNavigate]);

  const navigateToVolatility = useCallback((code: string, name: string) => {
    onNavigate('volatility', code, name);
  }, [onNavigate]);

  const navigateToSectorVolume = useCallback((code: string, name: string) => {
    onNavigate('sector-volume', code, name);
  }, [onNavigate]);

  return (
    <NavigationContext.Provider value={{ navigateToVolume, navigateToVolatility, navigateToSectorVolume }}>
      {children}
    </NavigationContext.Provider>
  );
};
