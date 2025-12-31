import React from 'react';
import { View, Text } from 'react-native';
import { cn } from '../utils/cn';

interface StatWidgetProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: string;
  color?: string;
  backgroundColor?: string;
  className?: string;
}

export function StatWidget({
  title,
  value,
  subtitle,
  color = '#2563EB',
  backgroundColor = '#FFFFFF',
  className,
}: StatWidgetProps) {
  // Determine if we're using a vibrant background color
  const isVibrantBackground = backgroundColor !== '#FFFFFF';
  const textColor = isVibrantBackground ? '#FFFFFF' : '#64748B';
  const subtitleColor = isVibrantBackground ? 'rgba(255, 255, 255, 0.9)' : '#94A3B8';
  const iconBgColor = isVibrantBackground ? 'rgba(255, 255, 255, 0.2)' : `${color}26`; // 15% opacity hex
  const iconDotColor = isVibrantBackground ? '#FFFFFF' : color;

  return (
    <View
      className={cn('flex-1 p-lg rounded-lg', className)}
      style={{
        backgroundColor,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        minHeight: 140,
      }}
    >
      <View
        className="w-10 h-10 rounded-md justify-center items-center mb-sm"
        style={{ backgroundColor: iconBgColor }}
      >
        <View
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: iconDotColor }}
        />
      </View>
      <Text className="text-sm mb-xs" style={{ color: textColor }}>
        {title}
      </Text>
      <Text className="text-3xl font-bold" style={{ color }}>
        {value}
      </Text>
      {subtitle && (
        <Text className="text-xs mt-xs" style={{ color: subtitleColor }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}
