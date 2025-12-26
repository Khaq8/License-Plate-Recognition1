import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLot } from '../contexts/LotContext';
import { adminApi, parkingApi } from '../services/api';
import { ActiveUserInLot } from '../types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants';

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
    <View style={modalStyles.overlay}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Vehicle Details</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={modalStyles.closeButton}>X</Text>
          </TouchableOpacity>
        </View>

        <View style={modalStyles.content}>
          <View style={modalStyles.plateContainer}>
            <Text style={modalStyles.plateText}>{user.plate}</Text>
          </View>

          <View style={modalStyles.detailRow}>
            <Text style={modalStyles.label}>User</Text>
            <Text style={modalStyles.value}>{user.username || 'Unknown'}</Text>
          </View>

          <View style={modalStyles.detailRow}>
            <Text style={modalStyles.label}>Car Brand</Text>
            <Text style={modalStyles.value}>{user.car_brand || 'Unknown'}</Text>
          </View>

          <View style={modalStyles.detailRow}>
            <Text style={modalStyles.label}>Entry Time</Text>
            <Text style={modalStyles.value}>
              {new Date(user.entry_time).toLocaleString()}
            </Text>
          </View>

          <View style={modalStyles.detailRow}>
            <Text style={modalStyles.label}>Duration</Text>
            <Text style={modalStyles.value}>{formatDuration(user.duration_minutes)}</Text>
          </View>

          <View style={[modalStyles.detailRow, modalStyles.chargeRow]}>
            <Text style={modalStyles.chargeLabel}>Estimated Charge</Text>
            <Text style={modalStyles.chargeValue}>${user.estimated_charge.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[modalStyles.checkoutButton, isLoading && modalStyles.checkoutButtonDisabled]}
          onPress={handleForceCheckout}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.surface} />
          ) : (
            <Text style={modalStyles.checkoutButtonText}>Force Checkout</Text>
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
    <TouchableOpacity style={styles.userRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.userRowLeft}>
        <Animated.View style={[styles.pulsingDot, { opacity: pulseAnim }]} />
        <View>
          <Text style={styles.plateText}>{user.plate}</Text>
          <Text style={styles.userText}>
            {user.username || 'Unknown User'}
            {user.car_brand ? ` - ${user.car_brand}` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.userRowRight}>
        <Text style={styles.durationText}>{formatDuration(user.duration_minutes)}</Text>
        <Text style={styles.chargeText}>${user.estimated_charge.toFixed(2)}</Text>
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
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No parking lot selected</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>User Management</Text>
        <Text style={styles.subtitle}>{selectedLot.name}</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by plate, name, or brand..."
          placeholderTextColor={COLORS.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={fetchActiveUsers}
        />
      </View>

      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {activeUsers.length} vehicle{activeUsers.length !== 1 ? 's' : ''} currently parked
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={activeUsers}
          keyExtractor={(item) => item.session_id.toString()}
          renderItem={({ item }) => (
            <ActiveUserRow user={item} onPress={() => handleUserPress(item)} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No vehicles currently parked</Text>
              <Text style={styles.emptySubtext}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  searchContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  searchInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  statsBar: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: `${COLORS.primary}10`,
  },
  statsText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: SPACING.md,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  userRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
    marginRight: SPACING.sm,
  },
  plateText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 1,
  },
  userText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  userRowRight: {
    alignItems: 'flex-end',
  },
  durationText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  chargeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.textSecondary,
    fontWeight: '300',
  },
  content: {
    padding: SPACING.lg,
  },
  plateContainer: {
    backgroundColor: COLORS.text,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  plateText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    letterSpacing: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  chargeRow: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderBottomWidth: 0,
    backgroundColor: `${COLORS.success}10`,
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  chargeLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  chargeValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.success,
  },
  checkoutButton: {
    backgroundColor: COLORS.danger,
    padding: SPACING.lg,
    alignItems: 'center',
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  checkoutButtonDisabled: {
    opacity: 0.6,
  },
  checkoutButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});
