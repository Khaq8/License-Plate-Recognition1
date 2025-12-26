import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from './Input';
import { Button } from './Button';
import { Dropdown } from './Dropdown';
import { CAR_BRANDS } from '../constants/carData';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants';
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
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Add Your Car</Text>
            <Text style={styles.subtitle}>Register your vehicle details</Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            disabled={isSubmitting}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
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
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              Your car information will be linked to your parking history for easier tracking.
            </Text>
          </View>
        </ScrollView>

        {/* Footer with Submit Button */}
        <View style={styles.footer}>
          <Button
            title="Register Car"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            size="large"
            style={styles.submitButton}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
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
  closeButton: {
    padding: SPACING.xs,
  },
  closeButtonText: {
    fontSize: FONT_SIZES.xxl,
    color: COLORS.textSecondary,
    fontWeight: '300',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZES.xs,
    marginBottom: SPACING.xs,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
  },
  typeButton: {
    width: '25%',
    aspectRatio: 1,
    padding: SPACING.sm,
    margin: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  typeIcon: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  typeLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.primary}10`,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    marginTop: SPACING.md,
  },
  infoIcon: {
    fontSize: FONT_SIZES.lg,
    marginRight: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  submitButton: {
    width: '100%',
  },
});
