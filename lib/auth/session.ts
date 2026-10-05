import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { UserProfile } from '../db/userStore';

const DEFAULT_SECRET = 'netrika-tele-ophthalmology-jwt-secret-key-2026-secure-token';
const sessionSecret = process.env.SESSION_SECRET || DEFAULT_SECRET;
const key = new TextEncoder().encode(sessionSecret);

export const COOKIE_NAME = 'netrika_session';

export interface SessionPayload {
  user: UserProfile;
  expiresAt: string;
}

/**
 * Signs a JWT token containing user profile information
 */
export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

/**
 * Verifies and decodes a JWT token
 */
export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Creates a server-side session and sets the HttpOnly authentication cookie
 */
export async function createSession(user: UserProfile) {
  const expiresAtDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const expiresAt = expiresAtDate.toISOString();
  const token = await encrypt({ user, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAtDate,
    sameSite: 'lax',
    path: '/',
  });

  return token;
}

/**
 * Reads and verifies the current session from HttpOnly cookies
 */
export async function getSession(): Promise<UserProfile | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await decrypt(token);
  if (!payload || !payload.user) return null;

  return payload.user;
}

/**
 * Deletes the session cookie on logout
 */
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
