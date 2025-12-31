import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { cn } from '../utils/cn';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  containerClassName?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  containerStyle,
  containerClassName,
  leftIcon,
  rightIcon,
  isPassword = false,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View
      className={cn('mb-md', containerClassName)}
      style={containerStyle}
    >
      {label && (
        <Text className="text-sm font-semibold text-text mb-sm">
          {label}
        </Text>
      )}
      <View
        className={cn(
          'flex-row items-center bg-surface rounded-md px-md',
          'border',
          isFocused ? 'border-primary border-2' : 'border-border',
          error && 'border-danger'
        )}
      >
        {leftIcon && (
          <View className="mr-xs">{leftIcon}</View>
        )}
        <TextInput
          className={cn(
            'flex-1 text-md text-text',
            leftIcon && 'ml-sm',
            (rightIcon || isPassword) && 'mr-sm'
          )}
          style={{ height: 48 }}
          placeholderTextColor="#94A3B8"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            className="ml-xs"
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text className="text-primary text-sm font-semibold">
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        )}
        {rightIcon && !isPassword && (
          <View className="ml-xs">{rightIcon}</View>
        )}
      </View>
      {error && (
        <Text className="text-danger text-xs mt-xs">
          {error}
        </Text>
      )}
    </View>
  );
}
