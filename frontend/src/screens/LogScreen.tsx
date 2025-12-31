import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '../utils/cn';
import { EntryCard } from '../components';
import { parkingService } from '../services/api';
import { useLot } from '../contexts/LotContext';
import { ParkingEntry, SortField, SortOrder, FilterOptions } from '../types';

type StatusFilter = 'all' | 'checked-in' | 'checked-out';

export function LogScreen() {
  const { selectedLot } = useLot();
  const [entries, setEntries] = useState<ParkingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('checkInTime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!selectedLot) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await parkingService.getEntries(selectedLot.id);
      setEntries(data);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedLot?.id]);

  useEffect(() => {
    if (selectedLot) {
      setIsLoading(true);
      fetchEntries();
    }
  }, [selectedLot?.id, fetchEntries]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEntries();
    setRefreshing(false);
  }, [fetchEntries]);

  // Filter and sort entries
  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((entry) =>
        entry.plate.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter === 'checked-in') {
      result = result.filter((entry) => !entry.checkOutTime);
    } else if (statusFilter === 'checked-out') {
      result = result.filter((entry) => entry.checkOutTime);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'plate':
          comparison = a.plate.localeCompare(b.plate);
          break;
        case 'checkInTime':
          comparison = new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime();
          break;
        case 'checkOutTime':
          const aTime = a.checkOutTime ? new Date(a.checkOutTime).getTime() : 0;
          const bTime = b.checkOutTime ? new Date(b.checkOutTime).getTime() : 0;
          comparison = aTime - bTime;
          break;
        default:
          comparison = new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime();
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [entries, searchQuery, statusFilter, sortField, sortOrder]);

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
        <View className="bg-surface rounded-t-xl p-lg pb-xxl">
          <View className="flex-row justify-between items-center mb-lg">
            <Text className="text-xl font-bold text-text">Filters & Sorting</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Text className="text-md text-primary font-semibold">Done</Text>
            </TouchableOpacity>
          </View>

          {/* Status Filter */}
          <Text className="text-sm font-semibold text-text-secondary mb-sm mt-md">Status</Text>
          <View className="flex-row flex-wrap gap-sm">
            {(['all', 'checked-in', 'checked-out'] as StatusFilter[]).map((status) => (
              <TouchableOpacity
                key={status}
                className={cn(
                  'px-md py-sm rounded-full border',
                  statusFilter === status
                    ? 'bg-primary border-primary'
                    : 'bg-background border-border'
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
                  {status === 'all' ? 'All' : status === 'checked-in' ? 'Parked' : 'Left'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sort Field */}
          <Text className="text-sm font-semibold text-text-secondary mb-sm mt-md">Sort By</Text>
          <View className="flex-row flex-wrap gap-sm">
            {[
              { field: 'checkInTime', label: 'Check In' },
              { field: 'checkOutTime', label: 'Check Out' },
              { field: 'plate', label: 'Plate' },
            ].map(({ field, label }) => (
              <TouchableOpacity
                key={field}
                className={cn(
                  'px-md py-sm rounded-full border',
                  sortField === field
                    ? 'bg-primary border-primary'
                    : 'bg-background border-border'
                )}
                onPress={() => setSortField(field as SortField)}
              >
                <Text
                  className={cn(
                    'text-sm',
                    sortField === field
                      ? 'text-surface font-semibold'
                      : 'text-text-secondary'
                  )}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sort Order */}
          <Text className="text-sm font-semibold text-text-secondary mb-sm mt-md">Order</Text>
          <View className="flex-row flex-wrap gap-sm">
            {[
              { order: 'desc', label: 'Newest First' },
              { order: 'asc', label: 'Oldest First' },
            ].map(({ order, label }) => (
              <TouchableOpacity
                key={order}
                className={cn(
                  'px-md py-sm rounded-full border',
                  sortOrder === order
                    ? 'bg-primary border-primary'
                    : 'bg-background border-border'
                )}
                onPress={() => setSortOrder(order as SortOrder)}
              >
                <Text
                  className={cn(
                    'text-sm',
                    sortOrder === order
                      ? 'text-surface font-semibold'
                      : 'text-text-secondary'
                  )}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reset Button */}
          <TouchableOpacity
            className="mt-xl py-md items-center rounded-md border border-danger"
            onPress={() => {
              setStatusFilter('all');
              setSortField('checkInTime');
              setSortOrder('desc');
              setSearchQuery('');
            }}
          >
            <Text className="text-danger text-md font-semibold">Reset Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="mt-md text-text-secondary text-md">Loading entries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-lg pt-md pb-sm">
        <Text className="text-2xl font-bold text-text">Parking Log</Text>
        <Text className="text-sm text-text-secondary mt-xs">
          {filteredAndSortedEntries.length} entries
        </Text>
      </View>

      {/* Search and Filter Bar */}
      <View className="flex-row px-lg pb-md gap-sm">
        <View className="flex-1 flex-row items-center bg-surface rounded-md px-md border border-border">
          <Text className="text-md mr-sm">🔍</Text>
          <TextInput
            className="flex-1 text-md text-text"
            style={{ height: 44 }}
            placeholder="Search by plate number..."
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
        <TouchableOpacity
          className="w-11 h-11 bg-surface rounded-md justify-center items-center border border-border"
          onPress={() => setShowFilterModal(true)}
        >
          <Text className="text-lg">⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Active Filters Display */}
      {(statusFilter !== 'all' || sortField !== 'checkInTime' || sortOrder !== 'desc') && (
        <View className="flex-row px-lg pb-sm gap-sm">
          {statusFilter !== 'all' && (
            <View className="px-sm py-xs rounded-full" style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)' }}>
              <Text className="text-xs text-primary font-medium">
                {statusFilter === 'checked-in' ? 'Parked' : 'Left'}
              </Text>
            </View>
          )}
          <View className="px-sm py-xs rounded-full" style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)' }}>
            <Text className="text-xs text-primary font-medium">
              {sortField === 'plate' ? 'By Plate' : sortField === 'checkOutTime' ? 'By Check Out' : 'By Check In'}
            </Text>
          </View>
          <View className="px-sm py-xs rounded-full" style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)' }}>
            <Text className="text-xs text-primary font-medium">
              {sortOrder === 'desc' ? '↓ Newest' : '↑ Oldest'}
            </Text>
          </View>
        </View>
      )}

      {/* Entries List */}
      <FlatList
        data={filteredAndSortedEntries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EntryCard entry={item} />}
        contentContainerStyle={{ padding: 24, paddingTop: 0 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center py-xxl">
            <Text style={{ fontSize: 48 }} className="mb-md">🚗</Text>
            <Text className="text-lg font-semibold text-text-secondary">No entries found</Text>
            <Text className="text-sm text-text-light mt-xs">
              {searchQuery
                ? 'Try a different search term'
                : 'Parking entries will appear here'}
            </Text>
          </View>
        }
      />

      {renderFilterModal()}
    </SafeAreaView>
  );
}
