import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '../utils/cn';
import { parkingApi } from '../services/api';
import { ParkingSession } from '../types';

type StatusFilter = 'all' | 'active' | 'completed';

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '-';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface ActivityCardProps {
  session: ParkingSession;
}

function ActivityCard({ session }: ActivityCardProps) {
  const isActive = session.status === 'active';

  return (
    <View
      className={cn(
        'bg-surface rounded-lg p-md mb-sm border',
        isActive ? 'border-primary' : 'border-border'
      )}
    >
      {/* Header: Plate and Status */}
      <View className="flex-row justify-between items-center mb-sm">
        <View className="flex-row items-center">
          <Text className="text-lg font-bold text-text">{session.plate}</Text>
          {session.car_brand && (
            <Text className="text-sm text-text-secondary ml-sm">
              {session.car_brand}
            </Text>
          )}
        </View>
        <View
          className={cn(
            'px-sm py-xs rounded-full',
            isActive ? 'bg-primary' : 'bg-success'
          )}
        >
          <Text className="text-xs text-surface font-semibold">
            {isActive ? 'Parked' : 'Completed'}
          </Text>
        </View>
      </View>

      {/* Location */}
      {session.lot_name && (
        <View className="flex-row items-center mb-sm">
          <Text className="text-md mr-xs">📍</Text>
          <Text className="text-sm text-text-secondary" numberOfLines={1}>
            {session.lot_name}
          </Text>
        </View>
      )}

      {/* Time Info */}
      <View className="flex-row justify-between items-center">
        <View className="flex-1">
          <Text className="text-xs text-text-light">Entry</Text>
          <Text className="text-sm text-text">
            {formatDate(session.entry_time)} {formatTime(session.entry_time)}
          </Text>
        </View>

        {session.exit_time ? (
          <View className="flex-1">
            <Text className="text-xs text-text-light">Exit</Text>
            <Text className="text-sm text-text">
              {formatDate(session.exit_time)} {formatTime(session.exit_time)}
            </Text>
          </View>
        ) : (
          <View className="flex-1">
            <Text className="text-xs text-text-light">Duration</Text>
            <Text className="text-sm text-primary font-semibold">
              {formatDuration(session.duration_minutes)} (ongoing)
            </Text>
          </View>
        )}

        {session.amount_charged !== null && session.amount_charged !== undefined && (
          <View className="items-end">
            <Text className="text-xs text-text-light">Charged</Text>
            <Text className="text-md text-text font-semibold">
              ${Number(session.amount_charged).toFixed(2)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function MyActivityScreen() {
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchSessions = useCallback(async () => {
    try {
      const data = await parkingApi.getMySessionsDetailed();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  }, [fetchSessions]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (session) =>
          session.plate.toLowerCase().includes(query) ||
          session.lot_name?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter === 'active') {
      result = result.filter((session) => session.status === 'active');
    } else if (statusFilter === 'completed') {
      result = result.filter((session) => session.status === 'completed');
    }

    return result;
  }, [sessions, searchQuery, statusFilter]);

  // Calculate totals
  const totals = useMemo(() => {
    const completed = sessions.filter((s) => s.status === 'completed');
    const totalSpent = completed.reduce(
      (sum, s) => sum + (Number(s.amount_charged) || 0),
      0
    );
    const activeCount = sessions.filter((s) => s.status === 'active').length;
    return { totalSpent, activeCount, totalSessions: sessions.length };
  }, [sessions]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="mt-md text-text-secondary text-md">
            Loading activity...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-lg pt-md pb-sm">
        <Text className="text-2xl font-bold text-text">My Activity</Text>
        <Text className="text-sm text-text-secondary mt-xs">
          {totals.totalSessions} sessions
          {totals.activeCount > 0 && ` (${totals.activeCount} active)`}
        </Text>
      </View>

      {/* Stats Bar */}
      {sessions.length > 0 && (
        <View className="flex-row px-lg pb-md gap-sm">
          <View className="flex-1 bg-surface rounded-md p-sm border border-border">
            <Text className="text-xs text-text-light">Total Spent</Text>
            <Text className="text-lg font-bold text-text">
              ${totals.totalSpent.toFixed(2)}
            </Text>
          </View>
          <View className="flex-1 bg-surface rounded-md p-sm border border-border">
            <Text className="text-xs text-text-light">Sessions</Text>
            <Text className="text-lg font-bold text-text">
              {totals.totalSessions}
            </Text>
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View className="flex-row px-lg pb-sm gap-sm">
        <View className="flex-1 flex-row items-center bg-surface rounded-md px-md border border-border">
          <Text className="text-md mr-sm">🔍</Text>
          <TextInput
            className="flex-1 text-md text-text"
            style={{ height: 44 }}
            placeholder="Search by plate or location..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text className="text-md text-text-light p-xs">✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter Chips */}
      <View className="flex-row px-lg pb-md gap-sm">
        {(['all', 'active', 'completed'] as StatusFilter[]).map((status) => (
          <TouchableOpacity
            key={status}
            className={cn(
              'px-md py-sm rounded-full border',
              statusFilter === status
                ? 'bg-primary border-primary'
                : 'bg-surface border-border'
            )}
            onPress={() => setStatusFilter(status)}
          >
            <Text
              className={cn(
                'text-sm',
                statusFilter === status
                  ? 'text-surface font-semibold'
                  : 'text-text-secondary'
              )}
            >
              {status === 'all' ? 'All' : status === 'active' ? 'Active' : 'Completed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sessions List */}
      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <ActivityCard session={item} />}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center py-xxl">
            <Text style={{ fontSize: 48 }} className="mb-md">
              🚗
            </Text>
            <Text className="text-lg font-semibold text-text-secondary">
              No activity yet
            </Text>
            <Text className="text-sm text-text-light mt-xs text-center px-lg">
              {sessions.length === 0
                ? 'Register a car in Settings to start tracking your parking activity'
                : 'No sessions match your search'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
