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

export interface CreateParkingLotRequest {
    name: string;
    address?: string;
    city?: string;
    capacity: number;
    hourly_rate: number;
}

interface AddParkingLotModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (lotData: CreateParkingLotRequest) => Promise<void>;
}

export function AddParkingLotModal({ visible, onClose, onSubmit }: AddParkingLotModalProps) {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [capacity, setCapacity] = useState('');
    const [hourlyRate, setHourlyRate] = useState('');
    const [errors, setErrors] = useState<{
        name?: string;
        capacity?: string;
        hourlyRate?: string;
    }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resetForm = () => {
        setName('');
        setAddress('');
        setCity('');
        setCapacity('');
        setHourlyRate('');
        setErrors({});
    };

    const validate = (): boolean => {
        const newErrors: typeof errors = {};

        if (!name.trim()) {
            newErrors.name = 'Parking lot name is required';
        } else if (name.trim().length < 3) {
            newErrors.name = 'Name must be at least 3 characters';
        }

        if (!capacity.trim()) {
            newErrors.capacity = 'Capacity is required';
        } else {
            const capacityNum = parseInt(capacity, 10);
            if (isNaN(capacityNum) || capacityNum <= 0) {
                newErrors.capacity = 'Capacity must be a positive number';
            }
        }

        if (!hourlyRate.trim()) {
            newErrors.hourlyRate = 'Hourly rate is required';
        } else {
            const rateNum = parseFloat(hourlyRate);
            if (isNaN(rateNum) || rateNum < 0) {
                newErrors.hourlyRate = 'Hourly rate must be a valid number';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            await onSubmit({
                name: name.trim(),
                address: address.trim() || undefined,
                city: city.trim() || undefined,
                capacity: parseInt(capacity, 10),
                hourly_rate: parseFloat(hourlyRate),
            });

            Alert.alert(
                'Success',
                `${name} has been created successfully!`,
                [{ text: 'OK' }]
            );

            resetForm();
            onClose();
        } catch (error) {
            Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to create parking lot. Please try again.',
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
                        <Text className="text-xl font-bold text-text">Add Parking Lot</Text>
                        <Text className="text-sm text-text-secondary mt-xs">
                            Create a new parking facility
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
                    {/* Lot Name Input */}
                    <Input
                        label="Parking Lot Name *"
                        placeholder="e.g., Main Entrance A"
                        value={name}
                        onChangeText={(text) => {
                            setName(text);
                            if (errors.name) {
                                setErrors({ ...errors, name: undefined });
                            }
                        }}
                        error={errors.name}
                    />

                    {/* City Input */}
                    <Input
                        label="City"
                        placeholder="e.g., San Francisco"
                        value={city}
                        onChangeText={setCity}
                    />

                    {/* Address Input */}
                    <Input
                        label="Address"
                        placeholder="e.g., 123 Main Street"
                        value={address}
                        onChangeText={setAddress}
                    />

                    {/* Capacity Input */}
                    <Input
                        label="Capacity *"
                        placeholder="e.g., 100"
                        value={capacity}
                        onChangeText={(text) => {
                            // Only allow numbers
                            const cleaned = text.replace(/[^0-9]/g, '');
                            setCapacity(cleaned);
                            if (errors.capacity) {
                                setErrors({ ...errors, capacity: undefined });
                            }
                        }}
                        error={errors.capacity}
                        keyboardType="numeric"
                    />

                    {/* Hourly Rate Input */}
                    <Input
                        label="Hourly Rate (USD) *"
                        placeholder="e.g., 2.50"
                        value={hourlyRate}
                        onChangeText={(text) => {
                            // Allow numbers and decimal point
                            const cleaned = text.replace(/[^0-9.]/g, '');
                            setHourlyRate(cleaned);
                            if (errors.hourlyRate) {
                                setErrors({ ...errors, hourlyRate: undefined });
                            }
                        }}
                        error={errors.hourlyRate}
                        keyboardType="decimal-pad"
                    />

                    {/* Info Box */}
                    <View className="flex-row bg-primary/10 p-md rounded-md mt-md border-l-primary" style={{ borderLeftWidth: 3 }}>
                        <Text className="text-lg mr-sm">ℹ️</Text>
                        <Text className="flex-1 text-sm text-text" style={{ lineHeight: 20 }}>
                            The parking lot will be visible to all users once created. You can update these
                            details later in settings.
                        </Text>
                    </View>
                </ScrollView>

                {/* Footer with Submit Button */}
                <View className="p-lg border-t border-border bg-surface">
                    <Button
                        title="Create Parking Lot"
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
