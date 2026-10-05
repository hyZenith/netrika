import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateUser,
  registerUser,
  getUsers,
  type UserRole,
} from '@/lib/db/userStore';
import { createSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const users = await getUsers();
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to retrieve users' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, password, role, ...extra } = body;

    if (action === 'register') {
      if (!email || !body.name || !role) {
        return NextResponse.json(
          { success: false, error: 'Full name, email, and role are required.' },
          { status: 400 }
        );
      }

      const res = await registerUser({
        name: body.name,
        email,
        password: password || 'password123',
        role: role as UserRole,
        phone: body.phone,
        operatorId: body.operatorId,
        centerName: body.centerName,
        district: body.district,
        medicalCouncilRegNo: body.medicalCouncilRegNo,
        hospitalAffiliation: body.hospitalAffiliation,
        subSpecialty: body.subSpecialty,
        designation: body.designation,
      });

      if (!res.success || !res.user) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 });
      }

      // Establish secure stateless session cookie
      await createSession(res.user);

      return NextResponse.json({
        success: true,
        message: 'Account successfully registered.',
        user: res.user,
      });
    }

    if (action === 'login' || !action) {
      if (!email) {
        return NextResponse.json(
          { success: false, error: 'Email address is required.' },
          { status: 400 }
        );
      }

      const res = await authenticateUser(email, password, role as UserRole | undefined);
      if (!res.success || !res.user) {
        return NextResponse.json({ success: false, error: res.error }, { status: 401 });
      }

      // Establish secure stateless session cookie
      await createSession(res.user);

      return NextResponse.json({
        success: true,
        message: 'Authentication successful.',
        user: res.user,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Auth route error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
