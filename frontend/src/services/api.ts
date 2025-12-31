import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, STORAGE_KEYS } from '../constants';
import { PlateDetection, ParkingEntry, ParkingStats, ParkingLot, ParkingLotStatus } from '../types';

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

// Parking service that combines API data with local processing
export const parkingService = {
  // Get parking stats
  getStats: async (maxCapacity: number): Promise<ParkingStats> => {
    try {
      const detections = await plateApi.getAll();
      const entries = transformToEntries(detections);
      return calculateStats(entries, maxCapacity);
    } catch (error) {
      console.error('Error fetching parking stats:', error);
      // Return empty stats on error
      return {
        currentOccupancy: 0,
        maxCapacity,
        availableSpots: maxCapacity,
      };
    }
  },

  // Get all parking entries
  getEntries: async (): Promise<ParkingEntry[]> => {
    try {
      const detections = await plateApi.getAll();
      return transformToEntries(detections);
    } catch (error) {
      console.error('Error fetching parking entries:', error);
      return [];
    }
  },

  // Search entries by plate
  searchEntries: async (query: string): Promise<ParkingEntry[]> => {
    try {
      const detections = await plateApi.search(query);
      return transformToEntries(detections);
    } catch (error) {
      console.error('Error searching entries:', error);
      return [];
    }
  },
};

// Parking Lot API calls
export const lotApi = {
  // Get all accessible parking lots
  getAll: async (): Promise<ParkingLot[]> => {
    return fetchWithAuth<ParkingLot[]>('/lots/');
  },

  // Get a specific parking lot by ID
  getById: async (lotId: number): Promise<ParkingLot> => {
    return fetchWithAuth<ParkingLot>(`/lots/${lotId}`);
  },

  // Get real-time occupancy status for a parking lot
  getStatus: async (lotId: number): Promise<ParkingLotStatus> => {
    return fetchWithAuth<ParkingLotStatus>(`/lots/${lotId}/status`);
  },

  // Create a new parking lot (admin only)
  create: async (lotData: {
    name: string;
    address?: string;
    city?: string;
    capacity: number;
    hourly_rate: number;
    latitude?: number;
    longitude?: number;
  }): Promise<ParkingLot> => {
    return fetchWithAuth<ParkingLot>('/lots/', {
      method: 'POST',
      body: JSON.stringify(lotData),
    });
  },

  // Update a parking lot (admin only)
  update: async (lotId: number, lotData: {
    name?: string;
    address?: string;
    city?: string;
    capacity?: number;
    hourly_rate?: number;
    is_active?: boolean;
    latitude?: number;
    longitude?: number;
  }): Promise<ParkingLot> => {
    return fetchWithAuth<ParkingLot>(`/lots/${lotId}`, {
      method: 'PUT',
      body: JSON.stringify(lotData),
    });
  },

  // Deactivate a parking lot (admin only)
  deactivate: async (lotId: number): Promise<void> => {
    await fetchWithAuth<void>(`/lots/${lotId}`, {
      method: 'DELETE',
    });
  },
};
