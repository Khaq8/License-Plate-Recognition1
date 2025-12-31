import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from './Input';
import { Button } from './Button';
import { Dropdown } from './Dropdown';
import { CAR_BRANDS } from '../constants/carData';
import type { CreateCarRequest } from '../types';

interface AddCarModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (carData: CreateCarRequest) => Promise<void>;
}

export function AddCarModal({ visible, onClose, onSubmit }: AddCarModalProps) {
  const [licensePlate, setLicensePlate] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [errors, setErrors] = useState<{
    licensePlate?: string;
    brand?: string;
    model?: string;
    color?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setLicensePlate('');
    setSelectedBrand('');
    setModel('');
    setColor('');
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!licensePlate.trim()) {
      newErrors.licensePlate = 'License plate is required';
    } else if (licensePlate.trim().length < 2) {
      newErrors.licensePlate = 'License plate must be at least 2 characters';
    }

    if (!selectedBrand) {
      newErrors.brand = 'Please select a brand';
    }

    if (!model) {
      newErrors.model = 'Please enter a car model';
    }

    if (!color) {
      newErrors.color = 'Please enter a car color';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        license_plate: licensePlate.trim().toUpperCase(),
        brand: selectedBrand,
        model: model.trim(),
        color: color.trim(),
        is_primary: true // Default to primary for now
      });

      Alert.alert(
        'Success',
        'Your car has been registered successfully!',
        [{ text: 'OK' }]
      );

      resetForm();
      onClose();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to register car. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="flex-row justify-between items-start px-lg py-md border-b border-border bg-surface">
          <View>
            <Text className="text-xl font-bold text-text">Add Your Car</Text>
            <Text className="text-sm text-text-secondary mt-xs">
              Register your vehicle details
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            disabled={isSubmitting}
            className="p-xs"
          >
            <Text className="text-2xl text-text-secondary font-light">✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* License Plate Input */}
          <Input
            label="License Plate Number"
            placeholder="e.g., ABC 1234"
            value={licensePlate}
            onChangeText={(text) => {
              setLicensePlate(text);
              if (errors.licensePlate) {
                setErrors({ ...errors, licensePlate: undefined });
              }
            }}
            error={errors.licensePlate}
            autoCapitalize="characters"
            maxLength={15}
          />

          {/* Model Input */}
          <Input
            label="Car Model"
            placeholder="e.g., Corolla, Civic"
            value={model}
            onChangeText={(text) => {
              setModel(text);
              if (errors.model) {
                setErrors({ ...errors, model: undefined });
              }
            }}
            error={errors.model}
          />

          {/* Color Input */}
          <Input
            label="Car Color"
            placeholder="e.g., White, Silver"
            value={color}
            onChangeText={(text) => {
              setColor(text);
              if (errors.color) {
                setErrors({ ...errors, color: undefined });
              }
            }}
            error={errors.color}
          />

          {/* Brand Dropdown */}
          <Dropdown
            label="Car Brand"
            placeholder="Select your car brand"
            value={selectedBrand}
            options={CAR_BRANDS}
            onSelect={(brand) => {
              setSelectedBrand(brand);
              if (errors.brand) {
                setErrors({ ...errors, brand: undefined });
              }
            }}
            error={errors.brand}
          />

          {/* Info Box */}
          <View className="flex-row bg-primary/10 p-md rounded-md mt-md border-l-primary" style={{ borderLeftWidth: 3 }}>
            <Text className="text-lg mr-sm">ℹ️</Text>
            <Text className="flex-1 text-sm text-text" style={{ lineHeight: 20 }}>
              Your car information will be linked to your parking history for easier tracking.
            </Text>
          </View>
        </ScrollView>

        {/* Footer with Submit Button */}
        <View className="p-lg border-t border-border bg-surface">
          <Button
            title="Register Car"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            size="large"
            className="w-full"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
