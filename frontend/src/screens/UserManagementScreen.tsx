import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '../utils/cn';
import { useLot } from '../contexts/LotContext';
import { adminApi, parkingApi } from '../services/api';
import { ActiveUserInLot } from '../types';

interface UserActionModalProps {
  visible: boolean;
  user: ActiveUserInLot | null;
  onClose: () => void;
  onForceCheckout: (sessionId: number) => Promise<void>;
}

function UserActionModal({ visible, user, onClose, onForceCheckout }: UserActionModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!visible || !user) return null;

  const handleForceCheckout = async () => {
    Alert.alert(
      'Force Checkout',
      `Are you sure you want to force checkout ${user.plate}?\n\nEstimated charge: $${user.estimated_charge.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Checkout',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await onForceCheckout(user.session_id);
              onClose();
            } catch (error) {
              Alert.alert('Error', 'Failed to force checkout');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  return (
    <View
      className="absolute top-0 left-0 right-0 bottom-0 justify-center p-lg"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <View className="bg-surface rounded-xl overflow-hidden">
        <View className="flex-row justify-between items-center p-lg border-b border-border">
          <Text className="text-lg font-semibold text-text">Vehicle Details</Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-xl text-text-secondary font-light">X</Text>
          </TouchableOpacity>
        </View>

        <View className="p-lg">
          <View className="bg-text px-lg py-md rounded-md self-center mb-lg">
            <Text className="text-surface text-xl font-bold" style={{ letterSpacing: 2 }}>
              {user.plate}
            </Text>
          </View>

          <View className="flex-row justify-between py-sm border-b border-border">
            <Text className="text-sm text-text-secondary">User</Text>
            <Text className="text-sm text-text font-medium">{user.username || 'Unknown'}</Text>
          </View>

          <View className="flex-row justify-between py-sm border-b border-border">
            <Text className="text-sm text-text-secondary">Car Brand</Text>
            <Text className="text-sm text-text font-medium">{user.car_brand || 'Unknown'}</Text>
          </View>

          <View className="flex-row justify-between py-sm border-b border-border">
            <Text className="text-sm text-text-secondary">Entry Time</Text>
            <Text className="text-sm text-text font-medium">
              {new Date(user.entry_time).toLocaleString()}
            </Text>
          </View>

          <View className="flex-row justify-between py-sm border-b border-border">
            <Text className="text-sm text-text-secondary">Duration</Text>
            <Text className="text-sm text-text font-medium">{formatDuration(user.duration_minutes)}</Text>
          </View>

          <View
            className="flex-row justify-between mt-md pt-md -mx-lg px-lg"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
          >
            <Text className="text-md font-semibold text-text">Estimated Charge</Text>
            <Text className="text-lg font-bold text-success">${user.estimated_charge.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity
          className={cn(
            'bg-danger p-lg items-center m-lg rounded-md',
            isLoading && 'opacity-60'
          )}
          onPress={handleForceCheckout}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-surface text-md font-semibold">Force Checkout</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ActiveUserRow({
  user,
  onPress,
}: {
  user: ActiveUserInLot;
  onPress: () => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  return (
    <TouchableOpacity
      className="flex-row justify-between items-center bg-surface p-md rounded-md mb-sm"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row items-center">
        <Animated.View
          className="w-2.5 h-2.5 rounded-full bg-success mr-sm"
          style={{ opacity: pulseAnim }}
        />
        <View>
          <Text className="text-md font-bold text-text" style={{ letterSpacing: 1 }}>
            {user.plate}
          </Text>
          <Text className="text-xs text-text-secondary mt-0.5">
            {user.username || 'Unknown User'}
            {user.car_brand ? ` - ${user.car_brand}` : ''}
          </Text>
        </View>
      </View>
      <View className="items-end">
        <Text className="text-sm font-semibold text-text">{formatDuration(user.duration_minutes)}</Text>
        <Text className="text-xs text-success mt-0.5">${user.estimated_charge.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function UserManagementScreen() {
  const { selectedLot } = useLot();
  const [activeUsers, setActiveUsers] = useState<ActiveUserInLot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ActiveUserInLot | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchActiveUsers = useCallback(async () => {
    if (!selectedLot) return;

    try {
      const users = await adminApi.getActiveUsersInLot(
        selectedLot.id,
        searchQuery || undefined
      );
      setActiveUsers(users);
    } catch (error) {
      console.error('Error fetching active users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedLot?.id, searchQuery]);

  useEffect(() => {
    fetchActiveUsers();
  }, [fetchActiveUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchActiveUsers();
    setRefreshing(false);
  }, [fetchActiveUsers]);

  const handleUserPress = (user: ActiveUserInLot) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleForceCheckout = async (sessionId: number) => {
    try {
      await parkingApi.forceCheckout(sessionId);
      Alert.alert('Success', 'Vehicle has been checked out');
      await fetchActiveUsers();
    } catch (error) {
      throw error;
    }
  };

  if (!selectedLot) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center">
          <Text className="text-md font-semibold text-text-secondary">No parking lot selected</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="p-lg border-b border-border bg-surface">
        <Text className="text-xl font-bold text-text">User Management</Text>
        <Text className="text-sm text-text-secondary mt-xs">{selectedLot.name}</Text>
      </View>

      <View className="p-md bg-surface">
        <TextInput
          className="bg-background rounded-md p-md text-md text-text"
          placeholder="Search by plate, name, or brand..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={fetchActiveUsers}
        />
      </View>

      <View className="px-lg py-sm" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)' }}>
        <Text className="text-sm text-primary font-medium">
          {activeUsers.length} vehicle{activeUsers.length !== 1 ? 's' : ''} currently parked
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={activeUsers}
          keyExtractor={(item) => item.session_id.toString()}
          renderItem={({ item }) => (
            <ActiveUserRow user={item} onPress={() => handleUserPress(item)} />
          )}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center p-xl">
              <Text className="text-md font-semibold text-text-secondary">No vehicles currently parked</Text>
              <Text className="text-sm text-text-light mt-xs">
                Active parking sessions will appear here
              </Text>
            </View>
          }
        />
      )}

      <UserActionModal
        visible={showModal}
        user={selectedUser}
        onClose={() => {
          setShowModal(false);
          setSelectedUser(null);
        }}
        onForceCheckout={handleForceCheckout}
      />
    </SafeAreaView>
  );
}
