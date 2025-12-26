import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { AuthProvider } from './src/contexts/AuthContext';
import { LotProvider } from './src/contexts/LotContext';
import { AppNavigator } from './src/navigation';

// Enable native screens for better performance
enableScreens(true);

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LotProvider>
          <StatusBar style="dark" />
          <AppNavigator />
        </LotProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
