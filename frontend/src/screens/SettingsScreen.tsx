import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '../utils/cn';
import { useAuth } from '../contexts/AuthContext';
import { Input, Button, AddCarModal } from '../components';
import { carApi } from '../services/api';
import type { Car, CreateCarRequest } from '../types';

export function SettingsScreen() {
  const { user, logout, updateUser, isAdmin } = useAuth();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showCarManagement, setShowCarManagement] = useState(false);
  const [showAddCar, setShowAddCar] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [cars, setCars] = useState<Car[]>([]);
  const [loadingCars, setLoadingCars] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  // Load cars when car management modal opens
  useEffect(() => {
    if (showCarManagement) {
      loadCars();
    }
  }, [showCarManagement]);

  const loadCars = async () => {
    setLoadingCars(true);
    try {
      const userCars = await carApi.getAll();
      setCars(userCars);
    } catch (error) {
      console.error('Error loading cars:', error);
      Alert.alert('Error', 'Failed to load your vehicles');
    } finally {
      setLoadingCars(false);
    }
  };

  const handleSaveProfile = () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    updateUser({ name: name.trim(), email: email.trim() });
    setShowEditProfile(false);
    Alert.alert('Success', 'Profile updated successfully');
  };

  const handleAddCar = async (carData: CreateCarRequest) => {
    try {
      await carApi.create(carData);
      await loadCars(); // Reload cars list
    } catch (error) {
      throw error; // Let AddCarModal handle the error
    }
  };

  const handleDeleteCar = (car: Car) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to remove ${car.license_plate}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await carApi.delete(car.id);
              await loadCars();
              Alert.alert('Success', 'Vehicle removed successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove vehicle');
            }
          },
        },
      ]
    );
  };

  const handleSetPrimary = async (car: Car) => {
    try {
      await carApi.setPrimary(car.id);
      await loadCars();
      Alert.alert('Success', `${car.license_plate} set as primary vehicle`);
    } catch (error) {
      Alert.alert('Error', 'Failed to set primary vehicle');
    }
  };

  const renderMenuItem = (
    title: string,
    subtitle: string,
    onPress: () => void,
    icon: string,
    danger = false
  ) => (
    <TouchableOpacity className="flex-row items-center p-md border-b border-border" onPress={onPress}>
      <View
        className="w-10 h-10 rounded-md justify-center items-center"
        style={{ backgroundColor: danger ? 'rgba(239, 68, 68, 0.08)' : '#F8FAFC' }}
      >
        <Text className="text-lg">{icon}</Text>
      </View>
      <View className="flex-1 ml-md">
        <Text className={cn('text-md font-medium', danger ? 'text-danger' : 'text-text')}>
          {title}
        </Text>
        <Text className="text-xs text-text-secondary mt-0.5">{subtitle}</Text>
      </View>
      <Text className="text-xl text-text-light">›</Text>
    </TouchableOpacity>
  );

  const renderEditProfileModal = () => (
    <Modal
      visible={showEditProfile}
      transparent
      animationType="slide"
      onRequestClose={() => setShowEditProfile(false)}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="w-full"
          >
            <View className="bg-surface rounded-t-xl p-lg pb-xxl">
              <View className="flex-row justify-between items-center mb-lg">
                <Text className="text-xl font-bold text-text">Edit Profile</Text>
                <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowEditProfile(false); }}>
                  <Text className="text-md text-primary font-semibold">Cancel</Text>
                </TouchableOpacity>
              </View>

              <Input
                label="Name"
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <Input
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Button
                title="Save Changes"
                onPress={handleSaveProfile}
                size="large"
                className="mt-md"
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  const renderCarManagementModal = () => (
    <Modal
      visible={showCarManagement}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCarManagement(false)}
    >
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="flex-row justify-between items-start px-lg py-md border-b border-border bg-surface">
          <View>
            <Text className="text-xl font-bold text-text">My Vehicles</Text>
            <Text className="text-sm text-text-secondary mt-xs">
              {cars.length} {cars.length === 1 ? 'vehicle' : 'vehicles'} registered
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowCarManagement(false)}>
            <Text className="text-md text-primary font-semibold">Done</Text>
          </TouchableOpacity>
        </View>

        {/* Cars List */}
        {loadingCars ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : cars.length === 0 ? (
          <View className="flex-1 justify-center items-center px-xxl">
            <Text style={{ fontSize: 64 }} className="mb-lg">🚗</Text>
            <Text className="text-lg font-semibold text-text mb-sm">No vehicles registered</Text>
            <Text className="text-sm text-text-secondary text-center">Add your first vehicle to get started</Text>
          </View>
        ) : (
          <FlatList
            data={cars}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ padding: 24 }}
            renderItem={({ item }) => (
              <View
                className="bg-surface rounded-lg p-md mb-md"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <View className="flex-row items-center mb-sm">
                  <View
                    className="w-12 h-12 rounded-md justify-center items-center mr-md"
                    style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)' }}
                  >
                    <Text className="text-xl">🚗</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-text" style={{ letterSpacing: 1 }}>
                      {item.license_plate}
                    </Text>
                    <Text className="text-sm text-text-secondary mt-0.5">
                      {item.brand} {item.model} {item.color && `• ${item.color}`}
                    </Text>
                  </View>
                  {item.is_primary && (
                    <View className="bg-success px-sm py-xs rounded-full">
                      <Text className="text-xs font-semibold text-surface">Primary</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row gap-sm mt-sm">
                  {!item.is_primary && (
                    <TouchableOpacity
                      className="flex-1 py-sm px-md rounded-md items-center"
                      style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)' }}
                      onPress={() => handleSetPrimary(item)}
                    >
                      <Text className="text-sm font-semibold text-primary">Set as Primary</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    className="flex-1 py-sm px-md rounded-md items-center"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)' }}
                    onPress={() => handleDeleteCar(item)}
                  >
                    <Text className="text-sm font-semibold text-danger">Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}

        {/* Add Car Button */}
        <View className="p-lg border-t border-border bg-surface">
          <Button
            title="Add New Vehicle"
            onPress={() => {
              setShowCarManagement(false);
              setTimeout(() => setShowAddCar(true), 300);
            }}
            size="large"
            className="w-full"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-lg pt-md pb-lg">
          <Text className="text-2xl font-bold text-text">Settings</Text>
        </View>

        {/* Profile Section */}
        <View
          className="flex-row items-center mx-lg p-lg rounded-lg"
          style={{
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <View
            className="w-16 h-16 rounded-full justify-center items-center"
            style={{ backgroundColor: isAdmin ? '#2563EB' : '#64748B' }}
          >
            <Text className="text-2xl font-bold text-surface">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View className="ml-md flex-1">
            <Text className="text-lg font-semibold text-text">{user?.name || 'User'}</Text>
            <Text className="text-sm text-text-secondary mt-0.5">{user?.email || 'user@example.com'}</Text>
            <View
              className="self-start px-sm py-xs rounded-full mt-sm"
              style={{ backgroundColor: isAdmin ? 'rgba(16, 185, 129, 0.13)' : 'rgba(100, 116, 139, 0.13)' }}
            >
              <Text
                className="text-xs font-semibold uppercase"
                style={{ color: isAdmin ? '#10B981' : '#64748B' }}
              >
                {user?.role || 'User'}
              </Text>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <Text className="text-sm font-semibold text-text-secondary mx-lg mt-xl mb-sm uppercase" style={{ letterSpacing: 1 }}>
          Account
        </Text>
        <View
          className="mx-lg rounded-lg overflow-hidden"
          style={{
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          {renderMenuItem(
            'Edit Profile',
            'Update your name and email',
            () => {
              setName(user?.name || '');
              setEmail(user?.email || '');
              setShowEditProfile(true);
            },
            '👤'
          )}
          {renderMenuItem(
            'Change Password',
            'Update your password',
            () => Alert.alert('Coming Soon', 'Password change will be available soon'),
            '🔒'
          )}
        </View>

        {/* Vehicle Management Section */}
        <Text className="text-sm font-semibold text-text-secondary mx-lg mt-xl mb-sm uppercase" style={{ letterSpacing: 1 }}>
          Vehicles
        </Text>
        <View
          className="mx-lg rounded-lg overflow-hidden"
          style={{
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          {renderMenuItem(
            'My Vehicles',
            `Manage your registered vehicles`,
            () => setShowCarManagement(true),
            '🚗'
          )}
        </View>

        {/* About Section */}
        <Text className="text-sm font-semibold text-text-secondary mx-lg mt-xl mb-sm uppercase" style={{ letterSpacing: 1 }}>
          About
        </Text>
        <View
          className="mx-lg rounded-lg overflow-hidden"
          style={{
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          {renderMenuItem(
            'App Version',
            'Version 1.0.0',
            () => {},
            'ℹ️'
          )}
          {renderMenuItem(
            'Privacy Policy',
            'Read our privacy policy',
            () => Alert.alert('Privacy Policy', 'Privacy policy details here'),
            '📄'
          )}
          {renderMenuItem(
            'Terms of Service',
            'Read our terms of service',
            () => Alert.alert('Terms of Service', 'Terms of service details here'),
            '📋'
          )}
        </View>

        {/* Danger Zone */}
        <Text className="text-sm font-semibold text-text-secondary mx-lg mt-xl mb-sm uppercase" style={{ letterSpacing: 1 }}>
          Session
        </Text>
        <View
          className="mx-lg rounded-lg overflow-hidden"
          style={{
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          {renderMenuItem(
            'Logout',
            'Sign out of your account',
            handleLogout,
            '🚪',
            true
          )}
        </View>

        {/* Footer */}
        <View className="items-center mt-xxl px-lg">
          <Text className="text-md font-semibold text-text-secondary">ParkingLot Pro</Text>
          <Text className="text-xs text-text-light mt-xs">FastALPR Parking Management System</Text>
        </View>
      </ScrollView>

      {renderEditProfileModal()}
      {renderCarManagementModal()}

      <AddCarModal
        visible={showAddCar}
        onClose={() => setShowAddCar(false)}
        onSubmit={handleAddCar}
      />
    </SafeAreaView>
  );
}
