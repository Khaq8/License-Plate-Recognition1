import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, STORAGE_KEYS, USE_MOCK_DATA } from '../constants';
import {
  PlateDetection,
  ParkingEntry,
  ParkingStats,
  ParkingLot,
  ParkingLotStatus,
  ParkingSession,
  ActiveUserInLot,
  UserWithDetails,
  ForceCheckoutResponse,
} from '../types';
import {
  MOCK_LOTS,
  MOCK_LOT_STATUSES,
  MOCK_ACTIVE_USERS,
  MOCK_SESSIONS,
  MOCK_ENTRIES,
  MOCK_USERS_WITH_DETAILS,
  delay
} from './mockData';

// Helper to get auth header
async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Generic fetch wrapper with auth
async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const authHeader = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Plate detection API calls
export const plateApi = {
  // Get all plate detections
  getAll: async (): Promise<PlateDetection[]> => {
    return fetchWithAuth<PlateDetection[]>('/plates/');
  },

  // Get detection by ID
  getById: async (id: number): Promise<PlateDetection> => {
    return fetchWithAuth<PlateDetection>(`/plates/id/${id}`);
  },

  // Search plates
  search: async (query: string): Promise<PlateDetection[]> => {
    return fetchWithAuth<PlateDetection[]>(`/plates/search?q=${encodeURIComponent(query)}`);
  },

  // Get plates by session
  getBySession: async (sessionId: string): Promise<PlateDetection[]> => {
    return fetchWithAuth<PlateDetection[]>(`/plates/session/${sessionId}`);
  },

  // Get best match for a plate
  getBestMatch: async (plate: string): Promise<PlateDetection> => {
    return fetchWithAuth<PlateDetection>(`/plates/search/${encodeURIComponent(plate)}/best`);
  },
};

// Transform plate detections into parking entries
// This simulates check-in/check-out logic based on consecutive detections
export function transformToEntries(detections: PlateDetection[]): ParkingEntry[] {
  const entriesByPlate = new Map<string, ParkingEntry[]>();

  // Sort detections by timestamp
  const sorted = [...detections].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Group and pair detections into entries
  sorted.forEach((detection) => {
    const plateEntries = entriesByPlate.get(detection.plate) || [];

    // Find if there's an open entry (no checkout) for this plate
    const openEntry = plateEntries.find((e) => !e.checkOutTime);

    if (openEntry) {
      // This detection is a check-out
      openEntry.checkOutTime = detection.timestamp;
    } else {
      // This is a new check-in
      plateEntries.push({
        id: `${detection.session_id}-${detection.id}`,
        plate: detection.plate,
        checkInTime: detection.timestamp,
        checkOutTime: null,
        sessionId: detection.session_id,
        ocrConfidence: detection.ocr_confidence,
        detectionConfidence: detection.detection_confidence,
      });
    }

    entriesByPlate.set(detection.plate, plateEntries);
  });

  // Flatten all entries
  const allEntries: ParkingEntry[] = [];
  entriesByPlate.forEach((entries) => allEntries.push(...entries));

  // Sort by check-in time descending (most recent first)
  return allEntries.sort(
    (a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
  );
}

// Calculate parking statistics
export function calculateStats(entries: ParkingEntry[], maxCapacity: number): ParkingStats {
  // Count cars currently parked (checked in but not checked out)
  const currentOccupancy = entries.filter((e) => !e.checkOutTime).length;

  return {
    currentOccupancy,
    maxCapacity,
    availableSpots: Math.max(0, maxCapacity - currentOccupancy),
  };
}

// Parking Lot API calls
export const lotApi = {
  // Get all accessible parking lots
  getAll: async (): Promise<ParkingLot[]> => {
    if (USE_MOCK_DATA) {
      await delay();
      return MOCK_LOTS;
    }
    return fetchWithAuth<ParkingLot[]>('/lots/');
  },

  // Get a specific lot
  getById: async (lotId: number): Promise<ParkingLot> => {
    if (USE_MOCK_DATA) {
      await delay();
      const lot = MOCK_LOTS.find(l => l.id === lotId);
      if (!lot) throw new Error('Lot not found');
      return lot;
    }
    return fetchWithAuth<ParkingLot>(`/lots/${lotId}`);
  },

  // Create a new parking lot (admin only)
  create: async (lotData: {
    name: string;
    address?: string;
    city?: string;
    capacity: number;
    hourly_rate: number;
  }): Promise<ParkingLot> => {
    if (USE_MOCK_DATA) {
      await delay();
      const newLot: ParkingLot = {
        id: Math.floor(Math.random() * 10000),
        name: lotData.name,
        address: lotData.address || null,
        city: lotData.city || null,
        capacity: lotData.capacity,
        hourly_rate: lotData.hourly_rate,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      return newLot;
    }
    return fetchWithAuth<ParkingLot>('/lots/', {
      method: 'POST',
      body: JSON.stringify(lotData),
    });
  },

  // Get lot status (occupancy)
  getStatus: async (lotId: number): Promise<ParkingLotStatus> => {
    if (USE_MOCK_DATA) {
      await delay();
      return MOCK_LOT_STATUSES[lotId] || MOCK_LOT_STATUSES[1];
    }
    return fetchWithAuth<ParkingLotStatus>(`/lots/${lotId}/status`);
  },

  // Get active vehicles in a lot
  getActiveVehicles: async (lotId: number): Promise<ParkingSession[]> => {
    if (USE_MOCK_DATA) {
      await delay();
      return MOCK_SESSIONS.filter(s => s.lot_id === lotId && !s.exit_time);
    }
    return fetchWithAuth<ParkingSession[]>(`/lots/${lotId}/active`);
  },
};

// Parking Session API calls
export const parkingApi = {
  // Record vehicle entry
  recordEntry: async (lotId: number, plate: string, confidence?: number): Promise<ParkingSession> => {
    if (USE_MOCK_DATA) {
      await delay();
      return {
        id: Math.floor(Math.random() * 10000),
        lot_id: lotId,
        plate: plate.toUpperCase(),
        car_id: null,
        user_id: null,
        entry_time: new Date().toISOString(),
        exit_time: null,
        entry_confidence: confidence || 0.99,
        exit_confidence: null,
        amount_charged: 0,
        is_force_checkout: false,
        created_at: new Date().toISOString(),
      };
    }
    return fetchWithAuth<ParkingSession>(`/parking/${lotId}/entry`, {
      method: 'POST',
      body: JSON.stringify({ plate, entry_confidence: confidence }),
    });
  },

  // Record vehicle exit
  recordExit: async (lotId: number, plate: string, confidence?: number): Promise<ParkingSession> => {
    if (USE_MOCK_DATA) {
      await delay();
      return {
        id: Math.floor(Math.random() * 10000),
        lot_id: lotId,
        plate: plate.toUpperCase(),
        car_id: null,
        user_id: null,
        entry_time: new Date(Date.now() - 3600000).toISOString(),
        exit_time: new Date().toISOString(),
        entry_confidence: 0.99,
        exit_confidence: confidence || 0.98,
        amount_charged: 0.500,
        is_force_checkout: false,
        created_at: new Date(Date.now() - 3600000).toISOString(),
      };
    }
    const params = new URLSearchParams({ plate });
    if (confidence) params.append('exit_confidence', confidence.toString());
    return fetchWithAuth<ParkingSession>(`/parking/${lotId}/exit?${params}`, {
      method: 'POST',
    });
  },

  // Get parking sessions with filters
  getSessions: async (params?: {
    lotId?: number;
    plate?: string;
    activeOnly?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<ParkingSession[]> => {
    if (USE_MOCK_DATA) {
      await delay();
      let sessions = [...MOCK_SESSIONS];
      if (params?.lotId) sessions = sessions.filter(s => s.lot_id === params.lotId);
      if (params?.plate) sessions = sessions.filter(s => s.plate.includes(params.plate!));
      if (params?.activeOnly) sessions = sessions.filter(s => !s.exit_time);
      return sessions;
    }
    const searchParams = new URLSearchParams();
    if (params?.lotId) searchParams.append('lot_id', params.lotId.toString());
    if (params?.plate) searchParams.append('plate', params.plate);
    if (params?.activeOnly) searchParams.append('active_only', 'true');
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const query = searchParams.toString();
    return fetchWithAuth<ParkingSession[]>(`/parking/sessions${query ? `?${query}` : ''}`);
  },

  // Force checkout a session
  forceCheckout: async (sessionId: number, reason?: string): Promise<ForceCheckoutResponse> => {
    if (USE_MOCK_DATA) {
      await delay();
      const session = MOCK_SESSIONS.find(s => s.id === sessionId) || MOCK_SESSIONS[0];
      return {
        session: {
          ...session,
          exit_time: new Date().toISOString(),
          is_force_checkout: true,
        },
        amount_charged: 1.500,
        message: 'Force checkout successful (Mock)',
      };
    }
    return fetchWithAuth<ForceCheckoutResponse>(`/parking/sessions/${sessionId}/force-checkout`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};

// Admin API calls
export const adminApi = {
  // Get all users
  getUsers: async (params?: {
    search?: string;
    hasActiveSession?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<UserWithDetails[]> => {
    if (USE_MOCK_DATA) {
      await delay();
      return MOCK_USERS_WITH_DETAILS;
    }
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.hasActiveSession !== undefined) {
      searchParams.append('has_active_session', params.hasActiveSession.toString());
    }
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const query = searchParams.toString();
    return fetchWithAuth<UserWithDetails[]>(`/admin/users${query ? `?${query}` : ''}`);
  },

  // Get user's parking sessions
  getUserSessions: async (userId: number, activeOnly?: boolean): Promise<ParkingSession[]> => {
    if (USE_MOCK_DATA) {
      await delay();
      return MOCK_SESSIONS;
    }
    const params = activeOnly ? '?active_only=true' : '';
    return fetchWithAuth<ParkingSession[]>(`/admin/users/${userId}/sessions${params}`);
  },

  // Get active users in a lot
  getActiveUsersInLot: async (lotId: number, search?: string): Promise<ActiveUserInLot[]> => {
    if (USE_MOCK_DATA) {
      await delay();
      let users = [...MOCK_ACTIVE_USERS];
      if (search) users = users.filter(u => u.username?.toLowerCase().includes(search.toLowerCase()) || u.plate.includes(search));
      return users;
    }
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return fetchWithAuth<ActiveUserInLot[]>(`/admin/lots/${lotId}/active-users${params}`);
  },
};

// Legacy parking service (for backward compatibility)
export const parkingService = {
  // Get parking stats for a specific lot
  getStats: async (lotId: number): Promise<ParkingStats> => {
    try {
      const status = await lotApi.getStatus(lotId);
      return {
        currentOccupancy: status.current_occupancy,
        maxCapacity: status.capacity,
        availableSpots: status.available_spots,
        occupancyPercentage: status.occupancy_percentage,
      };
    } catch (error) {
      console.error('Error fetching parking stats:', error);
      return {
        currentOccupancy: 0,
        maxCapacity: 100,
        availableSpots: 100,
      };
    }
  },

  // Get all parking entries for a lot (using sessions)
  getEntries: async (lotId: number): Promise<ParkingEntry[]> => {
    try {
      const sessions = await parkingApi.getSessions({ lotId, limit: 100 });
      return sessions.map((session) => ({
        id: session.id.toString(),
        plate: session.plate,
        checkInTime: session.entry_time,
        checkOutTime: session.exit_time,
        sessionId: session.id.toString(),
        ocrConfidence: session.entry_confidence || 0,
        detectionConfidence: session.entry_confidence || 0,
        lotId: session.lot_id,
        lotName: session.lot_name,
      }));
    } catch (error) {
      console.error('Error fetching parking entries:', error);
      return [];
    }
  },

  // Get entries from legacy plate detections (fallback)
  getLegacyEntries: async (): Promise<ParkingEntry[]> => {
    try {
      const detections = await plateApi.getAll();
      return transformToEntries(detections);
    } catch (error) {
      console.error('Error fetching legacy entries:', error);
      return [];
    }
  },

  // Search entries by plate
  searchEntries: async (lotId: number, query: string): Promise<ParkingEntry[]> => {
    try {
      const sessions = await parkingApi.getSessions({ lotId, plate: query });
      return sessions.map((session) => ({
        id: session.id.toString(),
        plate: session.plate,
        checkInTime: session.entry_time,
        checkOutTime: session.exit_time,
        sessionId: session.id.toString(),
        ocrConfidence: session.entry_confidence || 0,
        detectionConfidence: session.entry_confidence || 0,
        lotId: session.lot_id,
        lotName: session.lot_name,
      }));
    } catch (error) {
      console.error('Error searching entries:', error);
      return [];
    }
  },
};
