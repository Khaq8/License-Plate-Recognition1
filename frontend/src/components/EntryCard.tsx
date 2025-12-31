import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { cn } from '../utils/cn';
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
    <View
      className="bg-surface rounded-lg p-md mb-md"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="flex-row justify-between items-center mb-md">
        <View className="bg-text px-md py-sm rounded-md">
          <Text className="text-surface text-lg font-bold tracking-plate">
            {entry.plate}
          </Text>
        </View>
        <View className="flex-row items-center">
          {isCheckedIn && (
            <Animated.View
              className="w-2 h-2 rounded-full bg-success mr-xs"
              style={{ opacity: pulseAnim }}
            />
          )}
          <View
            className={cn(
              'px-md py-xs rounded-full',
              isCheckedIn ? 'bg-success/20' : 'bg-secondary/20'
            )}
          >
            <Text
              className={cn(
                'text-sm font-semibold',
                isCheckedIn ? 'text-success' : 'text-secondary'
              )}
            >
              {isCheckedIn ? 'Parked' : 'Left'}
            </Text>
          </View>
        </View>
      </View>

      <View className="border-t border-border pt-md">
        <View className="flex-row justify-between mb-sm">
          <Text className="text-sm text-text-secondary">Check In</Text>
          <Text className="text-sm text-text font-medium">
            {formatDateTime(entry.checkInTime)}
          </Text>
        </View>

        <View className="flex-row justify-between mb-sm">
          <Text className="text-sm text-text-secondary">Check Out</Text>
          <Text className="text-sm text-text font-medium">
            {entry.checkOutTime ? formatDateTime(entry.checkOutTime) : '—'}
          </Text>
        </View>

        <View className="flex-row justify-between mb-sm">
          <Text className="text-sm text-text-secondary">Duration</Text>
          <Text
            className={cn(
              'text-sm font-medium',
              isCheckedIn ? 'text-success' : 'text-text'
            )}
          >
            {formatDuration(entry.checkInTime, entry.checkOutTime)}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between mt-sm pt-sm border-t border-border">
        <Text className="text-xs text-text-light">
          Confidence: {(entry.ocrConfidence * 100).toFixed(1)}%
        </Text>
        <Text className="text-xs text-text-light">Session: {entry.sessionId}</Text>
      </View>
    </View>
  );
}
