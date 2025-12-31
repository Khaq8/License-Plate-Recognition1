import { Linking, Alert, Platform } from 'react-native';

/**
 * Opens Google Maps with directions to the specified location.
 * Falls back to browser if Google Maps app is not installed.
 */
export const openGoogleMaps = async (
  latitude: number,
  longitude: number,
  label?: string
): Promise<void> => {
  // Google Maps URL that works on both platforms
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  // Native Google Maps app URL
  const googleMapsAppUrl = Platform.select({
    ios: `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`,
    android: `google.navigation:q=${latitude},${longitude}`,
  });

  try {
    // Try to open Google Maps app first
    const canOpenApp = await Linking.canOpenURL(googleMapsAppUrl!);

    if (canOpenApp) {
      await Linking.openURL(googleMapsAppUrl!);
    } else {
      // Fallback to web URL (opens in browser or Google Maps web)
      await Linking.openURL(googleMapsUrl);
    }
  } catch (error) {
    Alert.alert(
      'Unable to open maps',
      'Could not open Google Maps. Please try again.',
      [{ text: 'OK' }]
    );
  }
};

/**
 * Opens Apple Maps (iOS) or Google Maps (Android) with the location.
 */
export const openMaps = async (
  latitude: number,
  longitude: number,
  label?: string
): Promise<void> => {
  const encodedLabel = encodeURIComponent(label || 'Parking Lot');

  const url = Platform.select({
    ios: `maps:?q=${encodedLabel}&ll=${latitude},${longitude}`,
    android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`,
  });

  try {
    await Linking.openURL(url!);
  } catch (error) {
    // Fallback to Google Maps web
    await Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    );
  }
};
