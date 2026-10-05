import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST() {
  try {
    await deleteSession();
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Logout failed' },
      { status: 500 }
    );
  }
}
