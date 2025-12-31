import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '../utils/cn';
import { useAuth } from '../contexts/AuthContext';
import { useLot } from '../contexts/LotContext';
import { StatWidget, AddCarModal, LotSelector } from '../components';
import { parkingService } from '../services/api';
import { ParkingStats, ParkingEntry, CreateCarRequest } from '../types';
import { API_BASE_URL } from '../constants';

export function DashboardScreen() {
  const { user, token } = useAuth();
  const { selectedLot, lotStatus, refreshStatus } = useLot();
  const [stats, setStats] = useState<ParkingStats | null>(null);
  const [recentEntries, setRecentEntries] = useState<ParkingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddCarModal, setShowAddCarModal] = useState(false);

  const fetchData = useCallback(async () => {
    if (!selectedLot) {
      setIsLoading(false);
      return;
    }

    try {
      const [parkingStats, entries] = await Promise.all([
        parkingService.getStats(selectedLot.id),
        parkingService.getEntries(selectedLot.id),
      ]);
      setStats(parkingStats);
      setRecentEntries(entries.slice(0, 5)); // Get latest 5 entries
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set default stats on error
      setStats({
        currentOccupancy: 0,
        maxCapacity: selectedLot?.capacity || 100,
        availableSpots: selectedLot?.capacity || 100,
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedLot?.id]);

  useEffect(() => {
    if (selectedLot) {
      setIsLoading(true);
      fetchData();
    }
  }, [selectedLot?.id, fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refreshStatus()]);
    setRefreshing(false);
  }, [fetchData, refreshStatus]);

  const handleAddCar = async (carData: CreateCarRequest) => {
    // TODO: Implement API call to backend
    // For now, this is a placeholder that will be connected to the backend
    const response = await fetch(`${API_BASE_URL}/cars`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`, // You'll need to get token from auth context
      },
      body: JSON.stringify(carData),
    });

    if (!response.ok) {
      throw new Error('Failed to register car');
    }

    return response.json();
  };

  const getOccupancyColor = (): string => {
    if (!stats) return '#2563EB';
    const percentage = stats.currentOccupancy / stats.maxCapacity;
    if (percentage >= 0.9) return '#EF4444';
    if (percentage >= 0.7) return '#F59E0B';
    return '#10B981';
  };

  // Get color based on availability (5 degrees from green to red)
  const getAvailabilityColor = (): { background: string; text: string } => {
    if (!stats) return { background: '#2563EB', text: '#FFFFFF' };

    const availabilityPercentage = stats.availableSpots / stats.maxCapacity;

    // 5 degrees of color vibrancy
    if (availabilityPercentage >= 0.8) {
      // 80-100% available - Vibrant Green (almost full availability)
      return { background: '#10B981', text: '#FFFFFF' }; // Emerald green
    } else if (availabilityPercentage >= 0.6) {
      // 60-80% available - Light Green
      return { background: '#34D399', text: '#FFFFFF' }; // Light emerald
    } else if (availabilityPercentage >= 0.4) {
      // 40-60% available - Yellow/Amber
      return { background: '#FBBF24', text: '#1E293B' }; // Amber
    } else if (availabilityPercentage >= 0.2) {
      // 20-40% available - Orange
      return { background: '#FB923C', text: '#FFFFFF' }; // Orange
    } else {
      // 0-20% available - Red (lacking space)
      return { background: '#EF4444', text: '#FFFFFF' }; // Red
    }
  };

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="mt-md text-text-secondary text-md">Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row justify-between items-start mb-lg">
          <View>
            <Text className="text-md text-text-secondary">{getGreeting()},</Text>
            <Text className="text-2xl font-bold text-text">{user?.name || 'User'}</Text>
          </View>
          <View className="bg-surface px-md py-sm rounded-md">
            <Text className="text-sm text-text-secondary font-medium">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        </View>

        {/* Parking Lot Selector */}
        <LotSelector />

        {/* Stats Widgets */}
        <Text className="text-lg font-semibold text-text mb-md mt-md">Parking Overview</Text>
        <StatWidget
          title="Available Spots"
          value={stats?.availableSpots ?? 0}
          subtitle={`of ${stats?.maxCapacity ?? selectedLot?.capacity ?? 100} total spots`}
          color={getAvailabilityColor().text}
          backgroundColor={getAvailabilityColor().background}
        />

        {/* Add Car Widget */}
        <TouchableOpacity
          className="flex-row items-center bg-surface p-lg rounded-lg mt-lg border-2 border-primary"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
            borderStyle: 'dashed',
          }}
          onPress={() => setShowAddCarModal(true)}
          activeOpacity={0.7}
        >
          <View
            className="w-12 h-12 rounded-md justify-center items-center mr-md"
            style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)' }}
          >
            <Text style={{ fontSize: 24 }}>🚗</Text>
          </View>
          <View className="flex-1">
            <Text className="text-md font-semibold text-text mb-0.5">Add Your Car</Text>
            <Text className="text-xs text-text-secondary">Register your vehicle for faster parking</Text>
          </View>
          <Text className="text-xl text-primary font-semibold">→</Text>
        </TouchableOpacity>

        {/* Occupancy Bar */}
        <View
          className="bg-surface p-lg rounded-lg mt-lg"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <View className="flex-row justify-between items-center mb-md">
            <Text className="text-md font-semibold text-text">Lot Capacity</Text>
            <Text className="text-lg font-bold text-primary">
              {stats ? Math.round((stats.currentOccupancy / stats.maxCapacity) * 100) : 0}%
            </Text>
          </View>
          <View className="h-2 bg-border rounded overflow-hidden">
            <View
              className="h-full rounded"
              style={{
                width: `${stats ? (stats.currentOccupancy / stats.maxCapacity) * 100 : 0}%`,
                backgroundColor: getOccupancyColor(),
              }}
            />
          </View>
          <View className="flex-row justify-between mt-md">
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-success mr-xs" />
              <Text className="text-xs text-text-secondary">Low (0-70%)</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-warning mr-xs" />
              <Text className="text-xs text-text-secondary">Medium (70-90%)</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-danger mr-xs" />
              <Text className="text-xs text-text-secondary">Full (90%+)</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <Text className="text-lg font-semibold text-text mb-md mt-md">Recent Activity</Text>
        <View
          className="bg-surface rounded-lg overflow-hidden"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          {recentEntries.length === 0 ? (
            <View className="p-xl items-center">
              <Text className="text-md font-semibold text-text-secondary">No recent activity</Text>
              <Text className="text-sm text-text-light mt-xs">
                Vehicle entries will appear here
              </Text>
            </View>
          ) : (
            recentEntries.map((entry, index) => (
              <View
                key={entry.id}
                className={cn(
                  'flex-row items-center p-md border-b border-border',
                  index === recentEntries.length - 1 && 'border-b-0'
                )}
              >
                <View className="w-9 h-9 rounded-full bg-background justify-center items-center mr-md">
                  <Text className="text-lg font-semibold text-primary">
                    {entry.checkOutTime ? '↑' : '↓'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-md font-semibold text-text" style={{ letterSpacing: 1 }}>
                    {entry.plate}
                  </Text>
                  <Text className="text-xs text-text-secondary mt-0.5">
                    {new Date(entry.checkInTime).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' - '}
                    {entry.checkOutTime ? 'Checked out' : 'Currently parked'}
                  </Text>
                </View>
                <View
                  className="px-sm py-xs rounded-full"
                  style={{
                    backgroundColor: entry.checkOutTime ? '#64748B' : '#10B981',
                  }}
                >
                  <Text className="text-xs font-semibold text-surface">
                    {entry.checkOutTime ? 'Left' : 'In'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Car Modal */}
      <AddCarModal
        visible={showAddCarModal}
        onClose={() => setShowAddCarModal(false)}
        onSubmit={handleAddCar}
      />
    </SafeAreaView>
  );
}
