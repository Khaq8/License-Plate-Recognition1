import React from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../contexts/AuthContext';
import { LotProvider } from '../contexts/LotContext';
import {
  LoginScreen,
  DashboardScreen,
  LogScreen,
  SettingsScreen,
  UserManagementScreen,
  SignupScreen,
} from '../screens';

// Type definitions for navigation
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Log: undefined;
  Users: undefined;
  Settings: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// Tab bar icon component
function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Log: '📋',
    Users: '👥',
    Settings: '⚙️',
  };

  return (
    <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.5 }}>
      {icons[name] || '•'}
    </Text>
  );
}

// Auth Navigator (Login screen)
function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

// Main Tab Navigator (After login)
function MainNavigator() {
  const { isAdmin } = useAuth();

  return (
    <LotProvider>
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        lazy: true,
        tabBarIcon: ({ focused }) => (
          <TabBarIcon name={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: 85,
          paddingTop: 8,
          paddingBottom: 25,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600' as const,
        },
      })}
    >
      <MainTab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      {isAdmin && (
        <MainTab.Screen
          name="Log"
          component={LogScreen}
          options={{ tabBarLabel: 'Log' }}
        />
      )}
      {isAdmin && (
        <MainTab.Screen
          name="Users"
          component={UserManagementScreen}
          options={{ tabBarLabel: 'Users' }}
        />
      )}
      <MainTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </MainTab.Navigator>
    </LotProvider>
  );
}

// Loading screen while checking auth state
function LoadingScreen() {
  return (
    <View className="flex-1 justify-center items-center bg-background">
      <ActivityIndicator size={36} color="#2563EB" />
    </View>
  );
}

// Root Navigator
export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading === true) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {isAuthenticated === true ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
