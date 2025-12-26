import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants';
import { useLot } from '../contexts/LotContext';
import { useAuth } from '../contexts/AuthContext';
import { ParkingLot } from '../types';
import { AddParkingLotModal, CreateParkingLotRequest } from './AddParkingLotModal';

export function LotSelector() {
  const { lots, selectedLot, selectLot, isLoading, createLot } = useLot();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showAddLotModal, setShowAddLotModal] = useState(false);

  const handleSelectLot = (lot: ParkingLot) => {
    selectLot(lot);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.selector, styles.loadingSelector]}>
          <Text style={styles.loadingText}>Loading lots...</Text>
        </View>
      </View>
    );
  }

  if (lots.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.selector, styles.emptySelector]}>
          <Text style={styles.emptyText}>No parking lots available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <View style={styles.lotInfo}>
          <View style={styles.lotIcon}>
            <Text style={styles.lotIconText}>P</Text>
          </View>
          <View style={styles.lotDetails}>
            <Text style={styles.lotName} numberOfLines={1}>
              {selectedLot?.name || 'Select Lot'}
            </Text>
            {selectedLot?.city && (
              <Text style={styles.lotCity} numberOfLines={1}>
                {selectedLot.city}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.dropdownArrow}>
          {lots.length > 1 ? '▼' : ''}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={isOpen && lots.length > 1}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Parking Lot</Text>
            </View>
            <FlatList
              data={lots}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.lotItem,
                    selectedLot?.id === item.id && styles.selectedLotItem,
                  ]}
                  onPress={() => handleSelectLot(item)}
                >
                  <View style={styles.lotItemIcon}>
                    <Text style={styles.lotItemIconText}>P</Text>
                  </View>
                  <View style={styles.lotItemInfo}>
                    <Text
                      style={[
                        styles.lotItemName,
                        selectedLot?.id === item.id && styles.selectedLotText,
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.lotItemDetails}>
                      {item.city ? `${item.city} • ` : ''}
                      {item.capacity} spots • ${item.hourly_rate}/hr
                    </Text>
                  </View>
                  {selectedLot?.id === item.id && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListFooterComponent={
                user?.role === 'admin' ? (
                  <>
                    <View style={styles.separator} />
                    <TouchableOpacity
                      style={styles.addLotItem}
                      onPress={() => {
                        setIsOpen(false);
                        setShowAddLotModal(true);
                      }}
                    >
                      <View style={styles.addLotIcon}>
                        <Text style={styles.addLotIconText}>+</Text>
                      </View>
                      <View style={styles.lotItemInfo}>
                        <Text style={styles.addLotText}>Add New Parking Lot</Text>
                        <Text style={styles.lotItemDetails}>Create a new facility</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                ) : null
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <AddParkingLotModal
        visible={showAddLotModal}
        onClose={() => setShowAddLotModal(false)}
        onSubmit={async (lotData: CreateParkingLotRequest) => {
          await createLot(lotData);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingSelector: {
    justifyContent: 'center',
  },
  emptySelector: {
    justifyContent: 'center',
    backgroundColor: `${COLORS.warning}10`,
    borderColor: COLORS.warning,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  emptyText: {
    color: COLORS.warning,
    fontSize: FONT_SIZES.sm,
  },
  lotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lotIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  lotIconText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  lotDetails: {
    flex: 1,
  },
  lotName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  lotCity: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dropdownArrow: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  lotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  selectedLotItem: {
    backgroundColor: `${COLORS.primary}10`,
  },
  lotItemIcon: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  lotItemIconText: {
    color: COLORS.surface,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  lotItemInfo: {
    flex: 1,
  },
  lotItemName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  selectedLotText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  lotItemDetails: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  checkmark: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  addLotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: `${COLORS.primary}05`,
  },
  addLotIcon: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  addLotIconText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.xl,
    fontWeight: '300',
  },
  addLotText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
