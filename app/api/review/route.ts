import { NextRequest, NextResponse } from 'next/server';
import { getCases, getScreeningStats, submitOphthalmologistReview } from '@/lib/db/caseStore';
import type { DRClass } from '@/lib/ai/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cases = await getCases();
    const stats = await getScreeningStats();
    return NextResponse.json({ success: true, cases, stats });
  } catch (error: any) {
    console.error('Review API GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve cases' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      caseId,
      finalDRLevel,
      clinicalNotes,
      reviewerName,
      reviewerRegNo,
      hospitalAffiliation,
      referralRecommendation,
    } = body;

    if (!caseId || finalDRLevel === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing caseId or finalDRLevel' },
        { status: 400 }
      );
    }

    const updatedCase = await submitOphthalmologistReview(caseId, {
      finalDRLevel: Number(finalDRLevel) as DRClass,
      clinicalNotes: clinicalNotes || '',
      reviewerName,
      reviewerRegNo,
      hospitalAffiliation,
      referralRecommendation,
    });

    if (!updatedCase) {
      return NextResponse.json(
        { success: false, error: 'Case not found' },
        { status: 404 }
      );
    }

    const cases = await getCases();
    const stats = await getScreeningStats();

    return NextResponse.json({
      success: true,
      case: updatedCase,
      cases,
      stats,
    });
  } catch (error: any) {
    console.error('Review API POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit review' },
      { status: 500 }
    );
  }
}
