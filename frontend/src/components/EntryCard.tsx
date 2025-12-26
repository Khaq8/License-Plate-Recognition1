import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants';
import { ParkingEntry } from '../types';

interface EntryCardProps {
  entry: ParkingEntry;
  onPress?: () => void;
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(checkIn: string, checkOut: string | null): string {
  if (!checkOut) return 'Ongoing';

  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  const durationMs = end - start;

  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function EntryCard({ entry, onPress }: EntryCardProps) {
  const isCheckedIn = !entry.checkOutTime;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsing animation for active parking sessions
  useEffect(() => {
    if (isCheckedIn) {
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
    } else {
      pulseAnim.setValue(1);
    }
  }, [isCheckedIn, pulseAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.plateContainer}>
          <Text style={styles.plateText}>{entry.plate}</Text>
        </View>
        <View style={styles.statusContainer}>
          {isCheckedIn && (
            <Animated.View
              style={[
                styles.pulsingDot,
                { opacity: pulseAnim },
              ]}
            />
          )}
          <View style={[styles.statusBadge, isCheckedIn ? styles.statusActive : styles.statusInactive]}>
            <Text style={[styles.statusText, isCheckedIn ? styles.statusTextActive : styles.statusTextInactive]}>
              {isCheckedIn ? 'Parked' : 'Left'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Check In</Text>
          <Text style={styles.detailValue}>{formatDateTime(entry.checkInTime)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Check Out</Text>
          <Text style={styles.detailValue}>
            {entry.checkOutTime ? formatDateTime(entry.checkOutTime) : '—'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Duration</Text>
          <Text style={[styles.detailValue, isCheckedIn && styles.durationActive]}>
            {formatDuration(entry.checkInTime, entry.checkOutTime)}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.confidence}>
          Confidence: {(entry.ocrConfidence * 100).toFixed(1)}%
        </Text>
        <Text style={styles.sessionId}>Session: {entry.sessionId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: SPACING.xs,
  },
  plateContainer: {
    backgroundColor: COLORS.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  plateText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    letterSpacing: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusActive: {
    backgroundColor: `${COLORS.success}20`,
  },
  statusInactive: {
    backgroundColor: `${COLORS.secondary}20`,
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  statusTextActive: {
    color: COLORS.success,
  },
  statusTextInactive: {
    color: COLORS.secondary,
  },
  details: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  detailLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  durationActive: {
    color: COLORS.success,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  confidence: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
  sessionId: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
});
