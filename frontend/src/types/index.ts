// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  credit_balance?: number;
  phone?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Parking Lot types
export interface ParkingLot {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  capacity: number;
  hourly_rate: number;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface ParkingLotStatus {
  lot_id: number;
  name: string;
  capacity: number;
  current_occupancy: number;
  available_spots: number;
  occupancy_percentage: number;
}

// Parking Session types
export interface ParkingSession {
  id: number;
  lot_id: number;
  plate: string;
  car_id: number | null;
  user_id: number | null;
  entry_time: string;
  exit_time: string | null;
  entry_confidence: number | null;
  exit_confidence: number | null;
  amount_charged: number | null;
  status: 'active' | 'completed';
  is_force_checkout: boolean;
  created_at: string;
  // Extended fields
  lot_name?: string;
  username?: string;
  car_brand?: string;
  duration_minutes?: number;
}

// Legacy types for compatibility
export interface ParkingEntry {
  id: string;
  plate: string;
  checkInTime: string;
  checkOutTime: string | null;
  sessionId: string;
  ocrConfidence: number;
  detectionConfidence: number;
  lotId?: number;
  lotName?: string;
}

export interface ParkingStats {
  currentOccupancy: number;
  maxCapacity: number;
  availableSpots: number;
  occupancyPercentage?: number;
}

// API Response types
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    username?: string;
    is_admin?: boolean;
  };
}

export interface PlateDetection {
  id: number;
  session_id: string;
  timestamp: string;
  plate: string;
  ocr_confidence: number;
  detection_confidence: number;
  gov_plate_numb?: string | null;
}

// Filter and sort types
export type SortField = 'timestamp' | 'plate' | 'checkInTime' | 'checkOutTime';
export type SortOrder = 'asc' | 'desc';

export interface FilterOptions {
  searchQuery: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  status: 'all' | 'checked-in' | 'checked-out';
}

// Car registration types
export interface Car {
  id: number;
  user_id: number;
  license_plate: string;
  brand?: string;
  model?: string;
  color?: string;
  is_primary: boolean;
  created_at: string;
}

export interface CreateCarRequest {
  license_plate: string;
  brand?: string;
  model?: string;
  color?: string;
  is_primary?: boolean;
}

// Active user in lot (for user management)
export interface ActiveUserInLot {
  user_id: number | null;
  username: string | null;
  plate: string;
  car_brand: string | null;
  entry_time: string;
  duration_minutes: number;
  estimated_charge: number;
  session_id: number;
}

// User with details (for admin)
export interface UserWithDetails {
  id: number;
  username: string;
  is_admin: boolean;
  credit_balance: number;
  phone: string | null;
  created_at: string;
  cars_count: number;
  active_sessions_count: number;
}

// Force checkout response
export interface ForceCheckoutResponse {
  session: ParkingSession;
  amount_charged: number;
  message: string;
}
