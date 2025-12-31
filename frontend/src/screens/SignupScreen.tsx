import React, { useState } from 'react';
import {
    View,
    Text,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Button } from '../components';
import { API_BASE_URL } from '../constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { hashPassword } from '../utils/password';

type Props = {
    navigation: NativeStackNavigationProp<any>;
};

export function SignupScreen({ navigation }: Props) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<{
        username?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        password?: string;
        confirmPassword?: string;
    }>({});
    const [isLoading, setIsLoading] = useState(false);

    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        if (!username.trim()) {
            newErrors.username = 'Username is required';
        } else if (username.trim().length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
        }

        if (!email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Please enter a valid email';
        }

        if (!firstName.trim()) {
            newErrors.firstName = 'First name is required';
        }

        if (!lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSignup = async () => {
        if (!validateForm()) return;

        setIsLoading(true);

        try {
            // Hash password before sending to backend (CWE-312, CWE-359 mitigation)
            const hashedPassword = await hashPassword(password);

            const payload = {
                username: username.trim(),
                email: email.trim(),
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                password: hashedPassword,
            };

            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const responseText = await response.text();

            if (!response.ok) {
                let errorDetail = 'Registration failed';
                try {
                    const errorData = JSON.parse(responseText);
                    errorDetail = errorData.detail || errorDetail;
                } catch (e) {
                    // CWE-532 mitigation: no sensitive data logging
                }
                throw new Error(errorDetail);
            }

            Alert.alert(
                'Success!',
                'Your account has been created. Please log in.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.navigate('Login'),
                    },
                ]
            );
        } catch (error) {
            // CWE-532 mitigation: sanitized error logging without sensitive data
            console.error('Registration failed');

            Alert.alert(
                'Registration Failed',
                error instanceof Error ? error.message : 'Please try again'
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center', paddingVertical: 32 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="items-center mb-xl">
                        <View
                            className="w-20 h-20 bg-primary rounded-xl justify-center items-center mb-md"
                            style={{
                                shadowColor: '#2563EB',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 8,
                            }}
                        >
                            <Text className="text-3xl font-bold text-surface">P</Text>
                        </View>
                        <Text className="text-2xl font-bold text-text mb-xs">Create Account</Text>
                        <Text className="text-sm text-text-secondary">Join our parking management system</Text>
                    </View>

                    <View
                        className="bg-surface p-lg rounded-lg"
                        style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: 3,
                        }}
                    >
                        <Input
                            label="Username *"
                            placeholder="Choose a username"
                            value={username}
                            onChangeText={(text) => {
                                setUsername(text);
                                if (errors.username) {
                                    setErrors({ ...errors, username: undefined });
                                }
                            }}
                            autoCapitalize="none"
                            autoCorrect={false}
                            error={errors.username}
                        />

                        <Input
                            label="Email *"
                            placeholder="your.email@example.com"
                            value={email}
                            onChangeText={(text) => {
                                setEmail(text);
                                if (errors.email) {
                                    setErrors({ ...errors, email: undefined });
                                }
                            }}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            error={errors.email}
                        />

                        <View className="flex-row gap-sm">
                            <View className="flex-1">
                                <Input
                                    label="First Name *"
                                    placeholder="John"
                                    value={firstName}
                                    onChangeText={(text) => {
                                        setFirstName(text);
                                        if (errors.firstName) {
                                            setErrors({ ...errors, firstName: undefined });
                                        }
                                    }}
                                    autoCapitalize="words"
                                    error={errors.firstName}
                                />
                            </View>
                            <View className="flex-1">
                                <Input
                                    label="Last Name *"
                                    placeholder="Doe"
                                    value={lastName}
                                    onChangeText={(text) => {
                                        setLastName(text);
                                        if (errors.lastName) {
                                            setErrors({ ...errors, lastName: undefined });
                                        }
                                    }}
                                    autoCapitalize="words"
                                    error={errors.lastName}
                                />
                            </View>
                        </View>

                        <Input
                            label="Password *"
                            placeholder="At least 6 characters"
                            value={password}
                            onChangeText={(text) => {
                                setPassword(text);
                                if (errors.password) {
                                    setErrors({ ...errors, password: undefined });
                                }
                            }}
                            isPassword
                            error={errors.password}
                        />

                        <Input
                            label="Confirm Password *"
                            placeholder="Re-enter your password"
                            value={confirmPassword}
                            onChangeText={(text) => {
                                setConfirmPassword(text);
                                if (errors.confirmPassword) {
                                    setErrors({ ...errors, confirmPassword: undefined });
                                }
                            }}
                            isPassword
                            error={errors.confirmPassword}
                        />

                        <Button
                            title="Create Account"
                            onPress={handleSignup}
                            loading={isLoading}
                            size="large"
                            className="mt-md"
                        />

                        <TouchableOpacity
                            className="mt-md items-center"
                            onPress={() => navigation.navigate('Login')}
                        >
                            <Text className="text-sm text-text-secondary">
                                Already have an account? <Text className="text-primary font-semibold">Sign In</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
