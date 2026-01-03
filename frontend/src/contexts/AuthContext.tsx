import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AuthState, User, LoginResponse } from '../types';
import { API_BASE_URL, STORAGE_KEYS, USE_MOCK_DATA } from '../constants';
import { MOCK_ADMIN_USER } from '../services/mockData';

// Action types
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGOUT' }
  | { type: 'RESTORE_TOKEN'; payload: { user: User; token: string } };

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'RESTORE_TOKEN':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    default:
      return state;
  }
}

// Context type
interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Clear stored credentials helper
  const clearStoredCredentials = async () => {
    console.log('[AuthContext] Clearing stored credentials...');
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
      console.log('[AuthContext] Credentials cleared successfully');
    } catch (e) {
      console.error('[AuthContext] Error clearing credentials:', e);
    }
  };

  // Restore token on app load
  useEffect(() => {
    async function restoreToken() {
      console.log('[AuthContext] Attempting to restore token...');
      try {
        if (USE_MOCK_DATA) {
          console.log('[AuthContext] Using mock data, restoring mock user');
          dispatch({
            type: 'RESTORE_TOKEN',
            payload: { user: MOCK_ADMIN_USER, token: 'mock-token-admin' }
          });
          return;
        }
        const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
        const userDataStr = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);

        console.log('[AuthContext] Token found:', !!token);
        console.log('[AuthContext] User data found:', !!userDataStr);

        if (token && userDataStr) {
          // Validate token format (JWT has 3 parts separated by dots)
          const parts = token.split('.');
          if (parts.length !== 3) {
            console.warn('[AuthContext] Invalid token format detected (not a JWT)');
            await clearStoredCredentials();
            dispatch({ type: 'SET_LOADING', payload: false });
            return;
          }

          const user = JSON.parse(userDataStr) as User;
          console.log('[AuthContext] Restoring session for user:', user.email);
          dispatch({ type: 'RESTORE_TOKEN', payload: { user, token } });
        } else {
          console.log('[AuthContext] No stored credentials found, user needs to login');
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        console.error('[AuthContext] Token restoration failed:', error);
        // Clear potentially corrupted credentials
        await clearStoredCredentials();
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }

    restoreToken();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[AuthContext] Login attempt for:', email);
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      console.log('[AuthContext] Sending login request to:', `${API_BASE_URL}/auth/login`);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('[AuthContext] Login response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[AuthContext] Login failed:', errorData);
        throw new Error(errorData.detail || 'Invalid credentials');
      }

      const data: LoginResponse = await response.json();
      console.log('[AuthContext] Login successful, user:', data.user?.email);

      // Use user data from login response
      const user: User = {
        id: data.user?.id || '1',
        email: data.user?.email || email,
        name: data.user?.username || email.split('@')[0],
        role: data.user?.is_admin ? 'admin' : 'user',
      };

      // Store token and user data securely
      console.log('[AuthContext] Storing credentials in SecureStore');
      await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, data.access_token);
      await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user));

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token: data.access_token } });
      console.log('[AuthContext] Login complete, user authenticated');

      return { success: true };
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  };

  const logout = async () => {
    console.log('[AuthContext] Logout initiated');
    try {
      console.log('[AuthContext] Deleting stored credentials...');
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
      console.log('[AuthContext] Credentials deleted successfully');
      dispatch({ type: 'LOGOUT' });
      console.log('[AuthContext] Logout complete, user unauthenticated');
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
      // Still dispatch logout to clear state even if SecureStore fails
      dispatch({ type: 'LOGOUT' });
    }
  };

  const updateUser = (updates: Partial<User>) => {
    if (state.user && state.token) {
      const updatedUser = { ...state.user, ...updates };
      SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser));
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user: updatedUser, token: state.token } });
    }
  };

  const isAdmin = state.user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
