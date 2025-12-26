import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Input, Button } from '../components';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, PARKING_CONFIG } from '../constants';

export function SettingsScreen() {
  const { user, logout, updateUser, isAdmin } = useAuth();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditCapacity, setShowEditCapacity] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [capacity, setCapacity] = useState(PARKING_CONFIG.MAX_CAPACITY.toString());

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const handleSaveProfile = () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    updateUser({ name: name.trim(), email: email.trim() });
    setShowEditProfile(false);
    Alert.alert('Success', 'Profile updated successfully');
  };

  const handleSaveCapacity = () => {
    const newCapacity = parseInt(capacity, 10);
    if (isNaN(newCapacity) || newCapacity < 1) {
      Alert.alert('Error', 'Please enter a valid capacity');
      return;
    }

    PARKING_CONFIG.MAX_CAPACITY = newCapacity;
    setShowEditCapacity(false);
    Alert.alert('Success', `Parking capacity updated to ${newCapacity}`);
  };

  const renderMenuItem = (
    title: string,
    subtitle: string,
    onPress: () => void,
    icon: string,
    danger = false
  ) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Text style={styles.menuIconText}>{icon}</Text>
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>
          {title}
        </Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );

  const renderEditProfileModal = () => (
    <Modal
      visible={showEditProfile}
      transparent
      animationType="slide"
      onRequestClose={() => setShowEditProfile(false)}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowEditProfile(false); }}>
                  <Text style={styles.modalClose}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <Input
                label="Name"
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <Input
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Button
                title="Save Changes"
                onPress={handleSaveProfile}
                size="large"
                style={styles.saveButton}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  const renderEditCapacityModal = () => (
    <Modal
      visible={showEditCapacity}
      transparent
      animationType="slide"
      onRequestClose={() => setShowEditCapacity(false)}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Parking Capacity</Text>
                <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowEditCapacity(false); }}>
                  <Text style={styles.modalClose}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.capacityDescription}>
                Set the maximum number of parking spots available in your lot.
              </Text>

              <Input
                label="Max Capacity"
                placeholder="Enter capacity"
                value={capacity}
                onChangeText={setCapacity}
                keyboardType="number-pad"
              />

              <Button
                title="Save Capacity"
                onPress={handleSaveCapacity}
                size="large"
                style={styles.saveButton}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Profile Section */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, !isAdmin && styles.avatarUser]}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'user@example.com'}</Text>
            <View style={[styles.roleBadge, !isAdmin && styles.roleBadgeUser]}>
              <Text style={[styles.roleText, !isAdmin && styles.roleTextUser]}>
                {user?.role || 'User'}
              </Text>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuSection}>
          {renderMenuItem(
            'Edit Profile',
            'Update your name and email',
            () => {
              setName(user?.name || '');
              setEmail(user?.email || '');
              setShowEditProfile(true);
            },
            '👤'
          )}
          {renderMenuItem(
            'Change Password',
            'Update your password',
            () => Alert.alert('Coming Soon', 'Password change will be available soon'),
            '🔒'
          )}
        </View>

        {/* Parking Settings Section - Admin Only */}
        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>Parking Settings</Text>
            <View style={styles.menuSection}>
              {renderMenuItem(
                'Lot Capacity',
                `Current: ${PARKING_CONFIG.MAX_CAPACITY} spots`,
                () => {
                  setCapacity(PARKING_CONFIG.MAX_CAPACITY.toString());
                  setShowEditCapacity(true);
                },
                '🅿️'
              )}
              {renderMenuItem(
                'Notifications',
                'Configure alerts and notifications',
                () => Alert.alert('Coming Soon', 'Notifications will be available soon'),
                '🔔'
              )}
            </View>
          </>
        )}

        {/* About Section */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.menuSection}>
          {renderMenuItem(
            'App Version',
            'Version 1.0.0',
            () => {},
            'ℹ️'
          )}
          {renderMenuItem(
            'Privacy Policy',
            'Read our privacy policy',
            () => Alert.alert('Privacy Policy', 'Privacy policy details here'),
            '📄'
          )}
          {renderMenuItem(
            'Terms of Service',
            'Read our terms of service',
            () => Alert.alert('Terms of Service', 'Terms of service details here'),
            '📋'
          )}
        </View>

        {/* Danger Zone */}
        <Text style={styles.sectionTitle}>Session</Text>
        <View style={styles.menuSection}>
          {renderMenuItem(
            'Logout',
            'Sign out of your account',
            handleLogout,
            '🚪',
            true
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>ParkingLot Pro</Text>
          <Text style={styles.footerSubtext}>FastALPR Parking Management System</Text>
        </View>
      </ScrollView>

      {renderEditProfileModal()}
      {renderEditCapacityModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarUser: {
    backgroundColor: COLORS.secondary,
  },
  avatarText: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.surface,
  },
  profileInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  profileName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  profileEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${COLORS.success}20`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  roleBadgeUser: {
    backgroundColor: `${COLORS.secondary}20`,
  },
  roleText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.success,
    textTransform: 'capitalize',
  },
  roleTextUser: {
    color: COLORS.secondary,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuSection: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIconDanger: {
    backgroundColor: `${COLORS.danger}15`,
  },
  menuIconText: {
    fontSize: FONT_SIZES.lg,
  },
  menuContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  menuTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  menuTitleDanger: {
    color: COLORS.danger,
  },
  menuSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.textLight,
  },
  footer: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  footerText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  footerSubtext: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalClose: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  capacityDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  saveButton: {
    marginTop: SPACING.md,
  },
  keyboardAvoid: {
    width: '100%',
  },
});
