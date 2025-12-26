import {
    ParkingLot,
    ParkingLotStatus,
    ParkingSession,
    User,
    ActiveUserInLot,
    UserWithDetails,
    ParkingEntry
} from '../types';

// Helper to get dates relative to now
const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000).toISOString();

// Mock Lots
export const MOCK_LOTS: ParkingLot[] = [
    {
        id: 1,
        name: 'Main Entrance A',
        address: 'Salmiya, Block 4',
        city: 'Salmiya',
        capacity: 120,
        hourly_rate: 0.500,
        is_active: true,
        created_at: hoursAgo(100),
    },
    {
        id: 2,
        name: 'Underground P2',
        address: 'Kuwait City, Floor -2',
        city: 'Kuwait City',
        capacity: 80,
        hourly_rate: 0.750,
        is_active: true,
        created_at: hoursAgo(200),
    },
    {
        id: 3,
        name: 'VIP Surface Lot',
        address: 'Ahmadi, East Wing',
        city: 'Ahmadi',
        capacity: 30,
        hourly_rate: 1.500,
        is_active: true,
        created_at: hoursAgo(300),
    }
];

// Mock Lot Statuses
export const MOCK_LOT_STATUSES: Record<number, ParkingLotStatus> = {
    1: {
        lot_id: 1,
        name: 'Main Entrance A',
        capacity: 120,
        current_occupancy: 45,
        available_spots: 75,
        occupancy_percentage: 37.5,
    },
    2: {
        lot_id: 2,
        name: 'Underground P2',
        capacity: 80,
        current_occupancy: 72,
        available_spots: 8,
        occupancy_percentage: 90.0,
    },
    3: {
        lot_id: 3,
        name: 'VIP Surface Lot',
        capacity: 30,
        current_occupancy: 5,
        available_spots: 25,
        occupancy_percentage: 16.7,
    }
};

// Mock User
export const MOCK_ADMIN_USER: User = {
    id: '1',
    email: 'admin@kuwaitparking.com',
    name: 'Ahmed Al-Sabah',
    role: 'admin',
    credit_balance: 25.500,
};

// Mock Active Users In Lot (for User Management)
export const MOCK_ACTIVE_USERS: ActiveUserInLot[] = [
    {
        user_id: 101,
        username: 'Jaber Al-Enezi',
        plate: '12-54321',
        car_brand: 'Toyota',
        entry_time: hoursAgo(2),
        duration_minutes: 120,
        estimated_charge: 1.000,
        session_id: 5001,
    },
    {
        user_id: 102,
        username: 'Sara Abbas',
        plate: '8-99001',
        car_brand: 'Lexus',
        entry_time: hoursAgo(0.5),
        duration_minutes: 30,
        estimated_charge: 0.500,
        session_id: 5004,
    },
    {
        user_id: 103,
        username: 'Mousa Al-Kandari',
        plate: '50-11223',
        car_brand: 'Chevrolet',
        entry_time: hoursAgo(5),
        duration_minutes: 300,
        estimated_charge: 2.500,
        session_id: 5005,
    },
    {
        user_id: 104,
        username: 'Fatima Dashti',
        plate: 'KUW-7788',
        car_brand: 'BYD',
        entry_time: minutesAgo(15),
        duration_minutes: 15,
        estimated_charge: 0.500,
        session_id: 5006,
    }
];

// Mock Parking Sessions (History/Log)
export const MOCK_SESSIONS: ParkingSession[] = [
    {
        id: 5001,
        lot_id: 1,
        plate: '12-54321',
        car_id: 201,
        user_id: 101,
        entry_time: hoursAgo(2),
        exit_time: null,
        entry_confidence: 0.98,
        exit_confidence: null,
        amount_charged: 1.000,
        is_force_checkout: false,
        created_at: hoursAgo(2),
        lot_name: 'Main Entrance A',
        username: 'Jaber Al-Enezi',
        car_brand: 'Toyota',
        duration_minutes: 120,
    },
    {
        id: 5002,
        lot_id: 1,
        plate: '9-44556',
        car_id: 202,
        user_id: 105,
        entry_time: hoursAgo(4),
        exit_time: hoursAgo(3),
        entry_confidence: 0.95,
        exit_confidence: 0.97,
        amount_charged: 0.500,
        is_force_checkout: false,
        created_at: hoursAgo(4),
        lot_name: 'Main Entrance A',
        username: 'Khalid',
        car_brand: 'Honda',
        duration_minutes: 60,
    },
    {
        id: 5003,
        lot_id: 1,
        plate: '7-12345',
        car_id: 203,
        user_id: 106,
        entry_time: hoursAgo(24),
        exit_time: hoursAgo(22),
        entry_confidence: 0.99,
        exit_confidence: 0.98,
        amount_charged: 1.000,
        is_force_checkout: true,
        created_at: hoursAgo(24),
        lot_name: 'Main Entrance A',
        username: 'Mariam',
        car_brand: 'Ford',
        duration_minutes: 120,
    }
];

// Mock Entries (Legacy/Dash format)
export const MOCK_ENTRIES: ParkingEntry[] = MOCK_SESSIONS.map(s => ({
    id: s.id.toString(),
    plate: s.plate,
    checkInTime: s.entry_time,
    checkOutTime: s.exit_time,
    sessionId: s.id.toString(),
    ocrConfidence: s.entry_confidence || 0.98,
    detectionConfidence: 0.99,
    lotId: s.lot_id,
    lotName: s.lot_name,
}));

// Mock Users with Details
export const MOCK_USERS_WITH_DETAILS: UserWithDetails[] = MOCK_ACTIVE_USERS.map(u => ({
    id: u.user_id!,
    username: u.username!,
    is_admin: false,
    is_super_admin: false,
    credit_balance: 15.0,
    phone: '965-12345678',
    created_at: hoursAgo(500),
    cars_count: 1,
    active_sessions_count: 1,
}));

// Helper to simulate API delay
export const delay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));
