import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }
    return NextResponse.json({ authenticated: true, user }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, error: error?.message || 'Session verification failed' },
      { status: 500 }
    );
  }
}
