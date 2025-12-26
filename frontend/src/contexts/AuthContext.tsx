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

  // Restore token on app load
  useEffect(() => {
    async function restoreToken() {
      try {
        if (USE_MOCK_DATA) {
          dispatch({
            type: 'RESTORE_TOKEN',
            payload: { user: MOCK_ADMIN_USER, token: 'mock-token-admin' }
          });
          return;
        }
        const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
        const userDataStr = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);

        if (token && userDataStr) {
          const user = JSON.parse(userDataStr) as User;
          dispatch({ type: 'RESTORE_TOKEN', payload: { user, token } });
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        console.error('Error restoring token:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }

    restoreToken();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // TODO: Remove hardcoded credentials before production
      // Test credentials: admin:1234 (full access) | user:1234 (limited access)
      if ((email === 'admin' || email === 'user') && password === '1234') {
        const isAdminUser = email === 'admin';
        const user: User = {
          id: isAdminUser ? '1' : '2',
          email: isAdminUser ? 'admin@parkinglot.com' : 'user@parkinglot.com',
          name: isAdminUser ? 'Admin' : 'User',
          role: isAdminUser ? 'admin' : 'user',
        };
        const testToken = `test-token-${email}`;

        await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, testToken);
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user));

        dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token: testToken } });
        return { success: true };
      }

      // Create form data for OAuth2 password flow
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Invalid credentials');
      }

      const data: LoginResponse = await response.json();

      // Create user object from email (you might want to fetch user details from another endpoint)
      const user: User = {
        id: '1',
        email: email,
        name: email.split('@')[0],
        role: 'admin',
      };

      // Store token and user data securely
      await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, data.access_token);
      await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user));

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token: data.access_token } });

      return { success: true };
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      console.error('Error during logout:', error);
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
