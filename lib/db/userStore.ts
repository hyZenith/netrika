import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { users } from './schema';
import { hashPassword, verifyPassword } from '../auth/password';

export type UserRole = 'Technician' | 'Ophthalmologist';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  // Technician-specific fields
  operatorId?: string;
  centerName?: string;
  district?: string;
  // Ophthalmologist-specific fields
  medicalCouncilRegNo?: string;
  hospitalAffiliation?: string;
  subSpecialty?: string;
  designation?: string;
  createdAt: string;
}

export interface StoredUser extends UserProfile {
  passwordHash: string;
}

// Default pre-seeded clinical and field accounts
export const defaultUsers: StoredUser[] = [
  {
    id: 'usr-tech-01',
    name: 'Anjali Devi',
    email: 'anjali.devi@ruralhealth.gov.in',
    role: 'Technician',
    phone: '+91 94350 12844',
    operatorId: 'TECH-AS-401',
    centerName: 'Sonitpur Rural Vision Centre / PHC',
    district: 'Sonitpur, Assam',
    createdAt: '2026-08-01T09:00:00.000Z',
    passwordHash: 'password123',
  },
  {
    id: 'usr-ophth-01',
    name: 'Dr. Rajesh Sharma, MS',
    email: 'dr.sharma@ruralhealth.gov.in',
    role: 'Ophthalmologist',
    phone: '+91 98640 55910',
    medicalCouncilRegNo: 'NMC-OPH-88421',
    hospitalAffiliation: 'Regional Institute of Ophthalmology / GMCH',
    subSpecialty: 'Vitreo-Retina & Diabetic Eye Disease',
    designation: 'Senior Consultant Ophthalmologist',
    createdAt: '2026-07-15T11:00:00.000Z',
    passwordHash: 'password123',
  },
];

// In-memory fallback if Neon DATABASE_URL is not yet provided
let fallbackUsers: StoredUser[] = [...defaultUsers];

// Flag to track whether default users have been synced into Postgres
let hasSeededPostgres = false;

async function ensureSeededPostgres() {
  if (!db || hasSeededPostgres) return;
  try {
    for (const defUser of defaultUsers) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, defUser.email.toLowerCase()))
        .limit(1);

      if (existing.length === 0) {
        const hashedPassword = await hashPassword(defUser.passwordHash);
        await db.insert(users).values({
          id: defUser.id,
          name: defUser.name,
          email: defUser.email.toLowerCase(),
          passwordHash: hashedPassword,
          role: defUser.role,
          phone: defUser.phone,
          operatorId: defUser.operatorId,
          centerName: defUser.centerName,
          district: defUser.district,
          medicalCouncilRegNo: defUser.medicalCouncilRegNo,
          hospitalAffiliation: defUser.hospitalAffiliation,
          subSpecialty: defUser.subSpecialty,
          designation: defUser.designation,
          createdAt: new Date(defUser.createdAt),
        });
      }
    }
    hasSeededPostgres = true;
  } catch (err) {
    console.error('Notice: Auto-seeding Neon PostgreSQL users deferred:', err);
  }
}

/**
 * Retrieves all registered user profiles (without password hashes)
 */
export async function getUsers(): Promise<UserProfile[]> {
  if (db) {
    try {
      await ensureSeededPostgres();
      const records = await db.select().from(users);
      return records.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        phone: r.phone || undefined,
        operatorId: r.operatorId || undefined,
        centerName: r.centerName || undefined,
        district: r.district || undefined,
        medicalCouncilRegNo: r.medicalCouncilRegNo || undefined,
        hospitalAffiliation: r.hospitalAffiliation || undefined,
        subSpecialty: r.subSpecialty || undefined,
        designation: r.designation || undefined,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch (err) {
      console.warn('Neon DB query error in getUsers, falling back to local store:', err);
    }
  }

  return fallbackUsers.map(({ passwordHash: _, ...rest }) => rest);
}

/**
 * Finds user by email address
 */
export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const normalizedEmail = email.toLowerCase().trim();

  if (db) {
    try {
      await ensureSeededPostgres();
      const records = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (records.length > 0) {
        const r = records[0];
        return {
          id: r.id,
          name: r.name,
          email: r.email,
          role: r.role,
          passwordHash: r.passwordHash,
          phone: r.phone || undefined,
          operatorId: r.operatorId || undefined,
          centerName: r.centerName || undefined,
          district: r.district || undefined,
          medicalCouncilRegNo: r.medicalCouncilRegNo || undefined,
          hospitalAffiliation: r.hospitalAffiliation || undefined,
          subSpecialty: r.subSpecialty || undefined,
          designation: r.designation || undefined,
          createdAt: r.createdAt.toISOString(),
        };
      }
      return undefined;
    } catch (err) {
      console.warn('Neon DB query error in findUserByEmail, falling back to local store:', err);
    }
  }

  return fallbackUsers.find((u) => u.email.toLowerCase() === normalizedEmail);
}

/**
 * Registers a new clinical user account
 */
export async function registerUser(userData: {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string;
  operatorId?: string;
  centerName?: string;
  district?: string;
  medicalCouncilRegNo?: string;
  hospitalAffiliation?: string;
  subSpecialty?: string;
  designation?: string;
}): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const existing = await findUserByEmail(userData.email);
  if (existing) {
    return { success: false, error: 'An account with this email address already exists.' };
  }

  const id = `usr-${userData.role === 'Technician' ? 'tech' : 'ophth'}-${Date.now().toString(36)}`;
  const rawPassword = userData.password || 'password123';
  const hashedPassword = await hashPassword(rawPassword);
  const now = new Date();

  const newUserRecord: StoredUser = {
    id,
    name: userData.name,
    email: userData.email.toLowerCase().trim(),
    role: userData.role,
    phone: userData.phone || '',
    operatorId: userData.operatorId || (userData.role === 'Technician' ? `TECH-${Math.floor(1000 + Math.random() * 9000)}` : undefined),
    centerName: userData.centerName || (userData.role === 'Technician' ? 'Primary Health Centre' : undefined),
    district: userData.district || '',
    medicalCouncilRegNo: userData.medicalCouncilRegNo || (userData.role === 'Ophthalmologist' ? `NMC-${Math.floor(10000 + Math.random() * 90000)}` : undefined),
    hospitalAffiliation: userData.hospitalAffiliation || (userData.role === 'Ophthalmologist' ? 'District Eye Hospital' : undefined),
    subSpecialty: userData.subSpecialty || (userData.role === 'Ophthalmologist' ? 'General Ophthalmology' : undefined),
    designation: userData.designation || (userData.role === 'Ophthalmologist' ? 'Consultant Ophthalmologist' : 'Vision Screener'),
    createdAt: now.toISOString(),
    passwordHash: hashedPassword,
  };

  if (db) {
    try {
      await ensureSeededPostgres();
      await db.insert(users).values({
        id: newUserRecord.id,
        name: newUserRecord.name,
        email: newUserRecord.email,
        passwordHash: newUserRecord.passwordHash,
        role: newUserRecord.role,
        phone: newUserRecord.phone,
        operatorId: newUserRecord.operatorId,
        centerName: newUserRecord.centerName,
        district: newUserRecord.district,
        medicalCouncilRegNo: newUserRecord.medicalCouncilRegNo,
        hospitalAffiliation: newUserRecord.hospitalAffiliation,
        subSpecialty: newUserRecord.subSpecialty,
        designation: newUserRecord.designation,
        createdAt: now,
      });

      const { passwordHash: _, ...safeUser } = newUserRecord;
      return { success: true, user: safeUser };
    } catch (err: any) {
      console.error('Error inserting user into Neon PostgreSQL:', err);
      // If error occurs, fallback to local store
    }
  }

  fallbackUsers.push(newUserRecord);
  const { passwordHash: _, ...safeUser } = newUserRecord;
  return { success: true, user: safeUser };
}

/**
 * Authenticates user credentials with password hash verification
 */
export async function authenticateUser(
  email: string,
  password?: string,
  expectedRole?: UserRole
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const user = await findUserByEmail(email);
  if (!user) {
    return { success: false, error: 'Account not found. Please register or check your email.' };
  }

  if (password) {
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return { success: false, error: 'Incorrect password entered.' };
    }
  }

  if (expectedRole && user.role !== expectedRole) {
    return {
      success: false,
      error: `This account is registered as a ${user.role}, not as ${expectedRole}.`,
    };
  }

  const { passwordHash: _, ...safeUser } = user;
  return { success: true, user: safeUser };
}
