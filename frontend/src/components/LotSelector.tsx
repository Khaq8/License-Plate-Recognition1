import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { cn } from '../utils/cn';
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
      <View className="mb-md">
        <View className="flex-row items-center justify-center bg-surface rounded-lg p-md border border-border">
          <Text className="text-text-secondary text-sm">Loading lots...</Text>
        </View>
      </View>
    );
  }

  if (lots.length === 0) {
    return (
      <View className="mb-md">
        <View className="flex-row items-center justify-center bg-warning/10 rounded-lg p-md border border-warning">
          <Text className="text-warning text-sm">No parking lots available</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-md">
      <TouchableOpacity
        className="flex-row items-center justify-between bg-surface rounded-lg p-md border border-border"
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-md bg-primary items-center justify-center mr-sm">
            <Text className="text-surface text-lg font-bold">P</Text>
          </View>
          <View className="flex-1">
            <Text className="text-md font-semibold text-text" numberOfLines={1}>
              {selectedLot?.name || 'Select Lot'}
            </Text>
            {selectedLot?.city && (
              <Text className="text-xs text-text-secondary mt-0.5" numberOfLines={1}>
                {selectedLot.city}
              </Text>
            )}
          </View>
        </View>
        <Text className="text-xs text-text-secondary ml-sm">
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
          className="flex-1 justify-center px-lg"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View
            className="bg-surface rounded-xl overflow-hidden"
            style={{ maxHeight: '70%' }}
          >
            <View className="p-lg border-b border-border">
              <Text className="text-lg font-semibold text-text text-center">
                Select Parking Lot
              </Text>
            </View>
            <FlatList
              data={lots}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className={cn(
                    'flex-row items-center p-md',
                    selectedLot?.id === item.id && 'bg-primary/10'
                  )}
                  onPress={() => handleSelectLot(item)}
                >
                  <View className="w-9 h-9 rounded-sm bg-primary items-center justify-center mr-sm">
                    <Text className="text-surface text-md font-bold">P</Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      className={cn(
                        'text-md font-medium',
                        selectedLot?.id === item.id
                          ? 'text-primary font-semibold'
                          : 'text-text'
                      )}
                    >
                      {item.name}
                    </Text>
                    <Text className="text-xs text-text-secondary mt-0.5">
                      {item.city ? `${item.city} • ` : ''}
                      {item.capacity} spots • ${item.hourly_rate}/hr
                    </Text>
                  </View>
                  {selectedLot?.id === item.id && (
                    <Text className="text-lg text-primary font-semibold">✓</Text>
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View className="h-px bg-border" />}
              ListFooterComponent={
                user?.role === 'admin' ? (
                  <>
                    <View className="h-px bg-border" />
                    <TouchableOpacity
                      className="flex-row items-center p-md"
                      style={{ backgroundColor: 'rgba(37, 99, 235, 0.02)' }}
                      onPress={() => {
                        setIsOpen(false);
                        setShowAddLotModal(true);
                      }}
                    >
                      <View
                        className="w-9 h-9 rounded-sm items-center justify-center mr-sm"
                        style={{
                          backgroundColor: 'transparent',
                          borderWidth: 2,
                          borderColor: '#2563EB',
                          borderStyle: 'dashed',
                        }}
                      >
                        <Text className="text-primary text-xl font-light">+</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-md font-semibold text-primary">
                          Add New Parking Lot
                        </Text>
                        <Text className="text-xs text-text-secondary mt-0.5">
                          Create a new facility
                        </Text>
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
