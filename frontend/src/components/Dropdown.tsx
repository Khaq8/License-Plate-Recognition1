import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { cn } from '../utils/cn';

interface DropdownProps {
  label: string;
  value: string;
  placeholder?: string;
  options: readonly string[];
  onSelect: (value: string) => void;
  error?: string;
}

export function Dropdown({
  label,
  value,
  placeholder = 'Select an option',
  options,
  onSelect,
  error,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (option: string) => {
    onSelect(option);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <View className="mb-md">
      {label && (
        <Text className="text-sm font-semibold text-text mb-sm">{label}</Text>
      )}
      <TouchableOpacity
        className={cn(
          'flex-row items-center justify-between bg-surface border rounded-md px-md',
          error ? 'border-danger' : 'border-border'
        )}
        style={{ height: 48 }}
        onPress={() => setIsOpen(true)}
      >
        <Text
          className={cn(
            'text-md flex-1',
            value ? 'text-text' : 'text-text-light'
          )}
        >
          {value || placeholder}
        </Text>
        <Text className="text-xs text-text-secondary">▼</Text>
      </TouchableOpacity>
      {error && (
        <Text className="text-danger text-xs mt-xs">{error}</Text>
      )}

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <KeyboardAvoidingView
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View
            className="bg-surface pb-xl"
            style={{
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '80%',
            }}
          >
            <View className="flex-row justify-between items-center p-lg border-b border-border">
              <Text className="text-lg font-semibold text-text">{label}</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Text className="text-xl text-text-secondary font-light">✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              className="m-lg p-md bg-background rounded-md text-md text-text"
              placeholder="Search..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView
              style={{ maxHeight: 400 }}
              keyboardShouldPersistTaps="handled"
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    className={cn(
                      'flex-row justify-between items-center px-lg py-md border-b border-border',
                      value === option && 'bg-primary/10'
                    )}
                    onPress={() => handleSelect(option)}
                  >
                    <Text
                      className={cn(
                        'text-md',
                        value === option
                          ? 'text-primary font-semibold'
                          : 'text-text'
                      )}
                    >
                      {option}
                    </Text>
                    {value === option && (
                      <Text className="text-lg text-primary font-semibold">✓</Text>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View className="p-xl items-center justify-center">
                  <Text className="text-md font-semibold text-text-secondary mb-xs">
                    Brand not found
                  </Text>
                  <Text className="text-sm text-text-light">
                    Try a different search term
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
