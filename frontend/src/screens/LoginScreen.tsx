import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Input, Button } from '../components';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export function LoginScreen({ navigation }: Props) {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    const result = await login(email, password);

    if (!result.success) {
      Alert.alert('Login Failed', result.error || 'Please check your credentials');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-xxl">
            <View
              className="w-20 h-20 bg-primary rounded-xl justify-center items-center mb-md"
              style={{
                shadowColor: '#2563EB',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Text className="text-3xl font-bold text-surface">P</Text>
            </View>
            <Text className="text-2xl font-bold text-text mb-xs">ParkingLot Pro</Text>
            <Text className="text-sm text-text-secondary">License Plate Recognition System</Text>
          </View>

          <View
            className="bg-surface p-lg rounded-lg"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text className="text-xl font-bold text-text mb-xs">Welcome back</Text>
            <Text className="text-sm text-text-secondary mb-lg">
              Sign in to access your parking management dashboard
            </Text>

            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              error={errors.email}
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              isPassword
              error={errors.password}
            />

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              size="large"
              className="mt-md"
            />

            <TouchableOpacity
              className="mt-md items-center"
              onPress={() => navigation.navigate('Signup')}
            >
              <Text className="text-sm text-text-secondary">
                Don't have an account? <Text className="text-primary font-semibold">Create one</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View className="items-center mt-xxl">
            <Text className="text-xs text-text-light">
              FastALPR Parking Management
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
