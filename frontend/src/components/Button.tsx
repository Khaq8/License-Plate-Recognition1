import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { cn } from '../utils/cn';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  className?: string;
  textClassName?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  className,
  textClassName,
}: ButtonProps) {
  // Button variant classes
  const variantClasses = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    outline: 'bg-transparent border-2 border-primary',
    danger: 'bg-danger',
  };

  // Button size classes
  const sizeClasses = {
    small: 'px-md py-sm',
    medium: 'px-lg py-md',
    large: 'px-xl py-lg',
  };

  // Text variant classes
  const textVariantClasses = {
    primary: 'text-surface',
    secondary: 'text-surface',
    outline: 'text-primary',
    danger: 'text-surface',
  };

  // Text size classes
  const textSizeClasses = {
    small: 'text-sm',
    medium: 'text-md',
    large: 'text-lg',
  };

  return (
    <TouchableOpacity
      className={cn(
        'items-center justify-center rounded-md',
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-50',
        className
      )}
      style={style}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? '#2563EB' : '#FFFFFF'}
          size="small"
        />
      ) : (
        <Text
          className={cn(
            'font-semibold',
            textVariantClasses[variant],
            textSizeClasses[size],
            disabled && 'opacity-70',
            textClassName
          )}
          style={textStyle}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
