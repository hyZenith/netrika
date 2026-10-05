import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password securely using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // If stored password is plain text (legacy pre-seeded default), allow comparison and return true
  if (hash === password) {
    return true;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    return false;
  }
}
