import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Button } from '../components';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, API_BASE_URL } from '../constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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

        const payload = {
            username: username.trim(),
            email: email.trim(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            password: password,
        };

        console.log('=== SIGNUP DEBUG ===');
        console.log('API_BASE_URL:', API_BASE_URL);
        console.log('Full URL:', `${API_BASE_URL}/auth/register`);
        console.log('Payload:', JSON.stringify(payload, null, 2));

        try {
            console.log('Sending fetch request...');
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

            const responseText = await response.text();
            console.log('Response body (raw):', responseText);

            if (!response.ok) {
                let errorDetail = 'Registration failed';
                try {
                    const errorData = JSON.parse(responseText);
                    errorDetail = errorData.detail || errorDetail;
                } catch (e) {
                    console.log('Could not parse error response as JSON');
                }
                throw new Error(errorDetail);
            }

            const successData = JSON.parse(responseText);
            console.log('Success response:', JSON.stringify(successData, null, 2));

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
            console.log('=== SIGNUP ERROR ===');
            console.log('Error type:', error?.constructor?.name);
            console.log('Error message:', error instanceof Error ? error.message : String(error));
            console.log('Full error:', error);

            Alert.alert(
                'Registration Failed',
                error instanceof Error ? error.message : 'Please try again'
            );
        } finally {
            setIsLoading(false);
            console.log('=== SIGNUP COMPLETE ===');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.header}>
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoText}>P</Text>
                        </View>
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Join our parking management system</Text>
                    </View>

                    <View style={styles.form}>
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

                        <View style={styles.nameRow}>
                            <View style={styles.nameField}>
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
                            <View style={styles.nameField}>
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
                            style={styles.signupButton}
                        />

                        <TouchableOpacity
                            style={styles.loginLink}
                            onPress={() => navigation.navigate('Login')}
                        >
                            <Text style={styles.loginLinkText}>
                                Already have an account? <Text style={styles.loginLinkBold}>Sign In</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: SPACING.lg,
        justifyContent: 'center',
        paddingVertical: SPACING.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    logoContainer: {
        width: 80,
        height: 80,
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.xl,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.md,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    logoText: {
        fontSize: FONT_SIZES.xxxl,
        fontWeight: '700',
        color: COLORS.surface,
    },
    title: {
        fontSize: FONT_SIZES.xxl,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    form: {
        backgroundColor: COLORS.surface,
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    nameRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    nameField: {
        flex: 1,
    },
    signupButton: {
        marginTop: SPACING.md,
    },
    loginLink: {
        marginTop: SPACING.md,
        alignItems: 'center',
    },
    loginLinkText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    loginLinkBold: {
        color: COLORS.primary,
        fontWeight: '600',
    },
});
