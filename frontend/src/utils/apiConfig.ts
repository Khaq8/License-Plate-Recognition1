import Constants from 'expo-constants';

// API Configuration with automatic detection for development
// This handles switching between devices and networks automatically

const API_PORT = 8000;

// Production URL - update this when you deploy
const PRODUCTION_API_URL = 'https://your-production-api.com';

/**
 * Automatically detects the correct API base URL based on the environment:
 * - Development (Expo Go): Uses the same IP as the Expo dev server
 * - Development (Simulator): Falls back to localhost/10.0.2.2
 * - Production: Uses the configured production URL
 */
function getApiBaseUrl(): string {
  // Check if we're in development mode
  const isDevelopment = __DEV__;

  if (!isDevelopment) {
    return PRODUCTION_API_URL;
  }

  // Try to get the debugger host from Expo (contains the dev machine's IP)
  const debuggerHost = Constants.expoConfig?.hostUri
    ?? Constants.manifest?.debuggerHost
    ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    // Extract just the IP/hostname (remove the port that Expo uses)
    const host = debuggerHost.split(':')[0];
    return `http://${host}:${API_PORT}`;
  }

  // Fallback for different platforms
  // Android emulator uses 10.0.2.2 to reach host machine's localhost
  // iOS simulator can use localhost directly
  const isAndroid = Constants.platform?.android !== undefined;
  const fallbackHost = isAndroid ? '10.0.2.2' : 'localhost';

  console.warn(
    `[API Config] Could not auto-detect host IP. Using fallback: ${fallbackHost}\n` +
    'If this fails, ensure Expo is running and try restarting the app.'
  );

  return `http://${fallbackHost}:${API_PORT}`;
}

// Export the computed API URL
export const API_BASE_URL = getApiBaseUrl();

// Log the detected URL in development for debugging
if (__DEV__) {
  console.log(`[API Config] Using API URL: ${API_BASE_URL}`);
}
