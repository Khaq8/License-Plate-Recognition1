import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants';

interface StatWidgetProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: string;
  color?: string;
  backgroundColor?: string;
}

export function StatWidget({
  title,
  value,
  subtitle,
  color = COLORS.primary,
  backgroundColor = COLORS.surface,
}: StatWidgetProps) {
  // Determine if we're using a vibrant background color
  const isVibrantBackground = backgroundColor !== COLORS.surface;
  const textColor = isVibrantBackground ? '#FFFFFF' : COLORS.textSecondary;
  const subtitleColor = isVibrantBackground ? 'rgba(255, 255, 255, 0.9)' : COLORS.textLight;
  const iconBgColor = isVibrantBackground ? 'rgba(255, 255, 255, 0.2)' : `${color}15`;
  const iconDotColor = isVibrantBackground ? '#FFFFFF' : color;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        <View style={[styles.iconDot, { backgroundColor: iconDotColor }]} />
      </View>
      <Text style={[styles.title, { color: textColor }]}>{title}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 140,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  iconDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  title: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  value: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
});
