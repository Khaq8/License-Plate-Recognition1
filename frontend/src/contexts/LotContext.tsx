import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ParkingLot, ParkingLotStatus } from '../types';
import { lotApi } from '../services/api';

const LOT_STORAGE_KEY = '@selected_lot_id';

interface LotState {
  lots: ParkingLot[];
  selectedLot: ParkingLot | null;
  lotStatus: ParkingLotStatus | null;
  isLoading: boolean;
  error: string | null;
}

type LotAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOTS'; payload: ParkingLot[] }
  | { type: 'SELECT_LOT'; payload: ParkingLot | null }
  | { type: 'SET_STATUS'; payload: ParkingLotStatus | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'REFRESH_STATUS'; payload: ParkingLotStatus };

const initialState: LotState = {
  lots: [],
  selectedLot: null,
  lotStatus: null,
  isLoading: true,
  error: null,
};

function lotReducer(state: LotState, action: LotAction): LotState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_LOTS':
      return { ...state, lots: action.payload, isLoading: false };
    case 'SELECT_LOT':
      return { ...state, selectedLot: action.payload, lotStatus: null };
    case 'SET_STATUS':
      return { ...state, lotStatus: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'REFRESH_STATUS':
      return { ...state, lotStatus: action.payload };
    default:
      return state;
  }
}

interface LotContextType extends LotState {
  selectLot: (lot: ParkingLot) => Promise<void>;
  refreshLots: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  createLot: (lotData: {
    name: string;
    address?: string;
    city?: string;
    capacity: number;
    hourly_rate: number;
  }) => Promise<ParkingLot>;
}

const LotContext = createContext<LotContextType | undefined>(undefined);

export function LotProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(lotReducer, initialState);

  // Load lots and restore selected lot on mount
  useEffect(() => {
    loadLots();
  }, []);

  // Fetch status when selected lot changes
  useEffect(() => {
    if (state.selectedLot) {
      fetchLotStatus(state.selectedLot.id);
    }
  }, [state.selectedLot?.id]);

  const loadLots = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const lots = await lotApi.getAll();
      dispatch({ type: 'SET_LOTS', payload: lots });

      // Restore previously selected lot
      const savedLotId = await AsyncStorage.getItem(LOT_STORAGE_KEY);
      if (savedLotId) {
        const savedLot = lots.find((l) => l.id === parseInt(savedLotId, 10));
        if (savedLot) {
          dispatch({ type: 'SELECT_LOT', payload: savedLot });
        } else if (lots.length > 0) {
          // Fallback to first lot
          dispatch({ type: 'SELECT_LOT', payload: lots[0] });
        }
      } else if (lots.length > 0) {
        // Select first lot by default
        dispatch({ type: 'SELECT_LOT', payload: lots[0] });
        await AsyncStorage.setItem(LOT_STORAGE_KEY, lots[0].id.toString());
      }
    } catch (error) {
      console.error('Error loading lots:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load parking lots' });
    }
  };

  const fetchLotStatus = async (lotId: number) => {
    try {
      const status = await lotApi.getStatus(lotId);
      dispatch({ type: 'SET_STATUS', payload: status });
    } catch (error) {
      console.error('Error fetching lot status:', error);
    }
  };

  const selectLot = useCallback(async (lot: ParkingLot) => {
    dispatch({ type: 'SELECT_LOT', payload: lot });
    await AsyncStorage.setItem(LOT_STORAGE_KEY, lot.id.toString());
  }, []);

  const refreshLots = useCallback(async () => {
    await loadLots();
  }, []);

  const refreshStatus = useCallback(async () => {
    if (state.selectedLot) {
      const status = await lotApi.getStatus(state.selectedLot.id);
      dispatch({ type: 'REFRESH_STATUS', payload: status });
    }
  }, [state.selectedLot?.id]);

  const createLot = useCallback(async (lotData: {
    name: string;
    address?: string;
    city?: string;
    capacity: number;
    hourly_rate: number;
  }): Promise<ParkingLot> => {
    const newLot = await lotApi.create(lotData);
    // Refresh lots to include the new one
    await loadLots();
    return newLot;
  }, []);

  return (
    <LotContext.Provider
      value={{
        ...state,
        selectLot,
        refreshLots,
        refreshStatus,
        createLot,
      }}
    >
      {children}
    </LotContext.Provider>
  );
}

export function useLot() {
  const context = useContext(LotContext);
  if (context === undefined) {
    throw new Error('useLot must be used within a LotProvider');
  }
  return context;
}
