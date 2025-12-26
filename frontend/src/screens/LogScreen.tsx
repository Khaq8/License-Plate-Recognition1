import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EntryCard } from '../components';
import { parkingService } from '../services/api';
import { useLot } from '../contexts/LotContext';
import { ParkingEntry, SortField, SortOrder, FilterOptions } from '../types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants';

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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters & Sorting</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Status Filter */}
          <Text style={styles.filterSectionTitle}>Status</Text>
          <View style={styles.filterOptions}>
            {(['all', 'checked-in', 'checked-out'] as StatusFilter[]).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterChip,
                  statusFilter === status && styles.filterChipActive,
                ]}
                onPress={() => setStatusFilter(status)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === status && styles.filterChipTextActive,
                  ]}
                >
                  {status === 'all' ? 'All' : status === 'checked-in' ? 'Parked' : 'Left'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sort Field */}
          <Text style={styles.filterSectionTitle}>Sort By</Text>
          <View style={styles.filterOptions}>
            {[
              { field: 'checkInTime', label: 'Check In' },
              { field: 'checkOutTime', label: 'Check Out' },
              { field: 'plate', label: 'Plate' },
            ].map(({ field, label }) => (
              <TouchableOpacity
                key={field}
                style={[
                  styles.filterChip,
                  sortField === field && styles.filterChipActive,
                ]}
                onPress={() => setSortField(field as SortField)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    sortField === field && styles.filterChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sort Order */}
          <Text style={styles.filterSectionTitle}>Order</Text>
          <View style={styles.filterOptions}>
            {[
              { order: 'desc', label: 'Newest First' },
              { order: 'asc', label: 'Oldest First' },
            ].map(({ order, label }) => (
              <TouchableOpacity
                key={order}
                style={[
                  styles.filterChip,
                  sortOrder === order && styles.filterChipActive,
                ]}
                onPress={() => setSortOrder(order as SortOrder)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    sortOrder === order && styles.filterChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reset Button */}
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              setStatusFilter('all');
              setSortField('checkInTime');
              setSortOrder('desc');
              setSearchQuery('');
            }}
          >
            <Text style={styles.resetButtonText}>Reset Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading entries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Parking Log</Text>
        <Text style={styles.subtitle}>
          {filteredAndSortedEntries.length} entries
        </Text>
      </View>

      {/* Search and Filter Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by plate number..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearButton}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Text style={styles.filterButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Active Filters Display */}
      {(statusFilter !== 'all' || sortField !== 'checkInTime' || sortOrder !== 'desc') && (
        <View style={styles.activeFilters}>
          {statusFilter !== 'all' && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText}>
                {statusFilter === 'checked-in' ? 'Parked' : 'Left'}
              </Text>
            </View>
          )}
          <View style={styles.activeFilterChip}>
            <Text style={styles.activeFilterText}>
              {sortField === 'plate' ? 'By Plate' : sortField === 'checkOutTime' ? 'By Check Out' : 'By Check In'}
            </Text>
          </View>
          <View style={styles.activeFilterChip}>
            <Text style={styles.activeFilterText}>
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
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>🚗</Text>
            <Text style={styles.emptyStateText}>No entries found</Text>
            <Text style={styles.emptyStateSubtext}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    fontSize: FONT_SIZES.md,
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  clearButton: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
    padding: SPACING.xs,
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButtonText: {
    fontSize: FONT_SIZES.lg,
  },
  activeFilters: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  activeFilterChip: {
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  activeFilterText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyStateText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyStateSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalClose: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  filterSectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.surface,
    fontWeight: '600',
  },
  resetButton: {
    marginTop: SPACING.xl,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  resetButtonText: {
    color: COLORS.danger,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});
