import * as Crypto from 'expo-crypto';

/**
 * Hash a password using SHA-256
 * Note: Client-side hashing adds a layer of security during transmission,
 * but the backend should still hash passwords before storing in the database.
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
    return hash;
  } catch (error) {
    // Sanitized error logging - no sensitive data
    console.error('Password hashing failed');
    throw new Error('Failed to process password');
  }
}
