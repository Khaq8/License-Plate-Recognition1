import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useLot } from '../contexts/LotContext';
import { StatWidget, AddCarModal, LotSelector } from '../components';
import { parkingService } from '../services/api';
import { ParkingStats, ParkingEntry, CreateCarRequest } from '../types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_BASE_URL } from '../constants';

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
    if (!stats) return COLORS.primary;
    const percentage = stats.currentOccupancy / stats.maxCapacity;
    if (percentage >= 0.9) return COLORS.danger;
    if (percentage >= 0.7) return COLORS.warning;
    return COLORS.success;
  };

  // Get color based on availability (5 degrees from green to red)
  const getAvailabilityColor = (): { background: string; text: string } => {
    if (!stats) return { background: COLORS.primary, text: '#FFFFFF' };

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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>
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
        <Text style={styles.sectionTitle}>Parking Overview</Text>
        <StatWidget
          title="Available Spots"
          value={stats?.availableSpots ?? 0}
          subtitle={`of ${stats?.maxCapacity ?? selectedLot?.capacity ?? 100} total spots`}
          color={getAvailabilityColor().text}
          backgroundColor={getAvailabilityColor().background}
        />

        {/* Add Car Widget */}
        <TouchableOpacity
          style={styles.addCarWidget}
          onPress={() => setShowAddCarModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.addCarIconContainer}>
            <Text style={styles.addCarIcon}>🚗</Text>
          </View>
          <View style={styles.addCarContent}>
            <Text style={styles.addCarTitle}>Add Your Car</Text>
            <Text style={styles.addCarSubtitle}>Register your vehicle for faster parking</Text>
          </View>
          <Text style={styles.addCarArrow}>→</Text>
        </TouchableOpacity>

        {/* Occupancy Bar */}
        <View style={styles.occupancyCard}>
          <View style={styles.occupancyHeader}>
            <Text style={styles.occupancyTitle}>Lot Capacity</Text>
            <Text style={styles.occupancyPercent}>
              {stats ? Math.round((stats.currentOccupancy / stats.maxCapacity) * 100) : 0}%
            </Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${stats ? (stats.currentOccupancy / stats.maxCapacity) * 100 : 0}%`,
                  backgroundColor: getOccupancyColor(),
                },
              ]}
            />
          </View>
          <View style={styles.occupancyLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.legendText}>Low (0-70%)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} />
              <Text style={styles.legendText}>Medium (70-90%)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
              <Text style={styles.legendText}>Full (90%+)</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.recentActivity}>
          {recentEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No recent activity</Text>
              <Text style={styles.emptyStateSubtext}>
                Vehicle entries will appear here
              </Text>
            </View>
          ) : (
            recentEntries.map((entry, index) => (
              <View
                key={entry.id}
                style={[
                  styles.activityItem,
                  index === recentEntries.length - 1 && styles.lastActivityItem,
                ]}
              >
                <View style={styles.activityIcon}>
                  <Text style={styles.activityIconText}>
                    {entry.checkOutTime ? '↑' : '↓'}
                  </Text>
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityPlate}>{entry.plate}</Text>
                  <Text style={styles.activityTime}>
                    {new Date(entry.checkInTime).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' - '}
                    {entry.checkOutTime ? 'Checked out' : 'Currently parked'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.activityStatus,
                    { backgroundColor: entry.checkOutTime ? COLORS.secondary : COLORS.success },
                  ]}
                >
                  <Text style={styles.activityStatusText}>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  dateContainer: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  dateText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  widgetsRow: {
    flexDirection: 'row',
  },
  widgetSpacer: {
    width: SPACING.md,
  },
  occupancyCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  occupancyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  occupancyTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  occupancyPercent: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  occupancyLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  legendText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  recentActivity: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  emptyState: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyStateSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  lastActivityItem: {
    borderBottomWidth: 0,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  activityIconText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.primary,
  },
  activityContent: {
    flex: 1,
  },
  activityPlate: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: 1,
  },
  activityTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  activityStatus: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  activityStatusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.surface,
  },
  addCarWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  addCarIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  addCarIcon: {
    fontSize: 24,
  },
  addCarContent: {
    flex: 1,
  },
  addCarTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  addCarSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  addCarArrow: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
