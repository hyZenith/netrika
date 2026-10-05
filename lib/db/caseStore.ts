import fs from 'fs';
import path from 'path';
import { eq, desc } from 'drizzle-orm';
import { db } from './drizzle';
import { cases } from './schema';
import type {
  CaseRecord,
  DRClass,
  ScreeningResult,
  PatientMetadata,
  ScreenerMetadata,
  CaseStatus,
  SpecialistReview,
} from '../ai/types';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'cases.json');

// Default pre-seeded test cases (all 3 initially PENDING_REVIEW as required)
export const defaultCases: CaseRecord[] = [
  {
    id: 'NET-2026-0001',
    caseStatus: 'PENDING_REVIEW',
    level: 'Level 3',
    drLevelNum: 3,
    drClassName: 'Severe DR',
    confidence: '92.4%',
    status: 'Referable',
    priority: 'Pending Ophthalmologist Review',
    imageSrc: '/samples/sample-3-severe-dr.jpg',
    originalImageSrc: '/samples/sample-3-severe-dr.jpg',
    timestamp: '2026-09-10T08:30:00.000Z',
    patient: {
      name: 'Ramesh Gogoi',
      age: 58,
      gender: 'Male',
      diabetesYears: 12,
      eye: 'OD',
      abhaId: 'ABHA-9821-4402',
    },
    screener: {
      name: 'Anjali Devi',
      operatorId: 'TECH-AS-401',
      centerName: 'Sonitpur Rural Vision Centre / PHC',
    },
    quality: {
      isRetinal: true,
      isGradable: true,
      score: 94,
      status: 'Gradable',
      clarity: 93,
      illumination: 95,
      reasons: [],
    },
    evidence: [
      { name: 'Severe hemorrhages in 4 quadrants', confidence: '94%', tone: 'coral' },
      { name: 'Venous beading', confidence: '89%', tone: 'violet' },
      { name: 'Cotton wool spots', confidence: '82%', tone: 'amber' },
    ],
  },
  {
    id: 'NET-2026-0002',
    caseStatus: 'PENDING_REVIEW',
    level: 'Level 2',
    drLevelNum: 2,
    drClassName: 'Moderate DR',
    confidence: '94.8%',
    status: 'Referable',
    priority: 'Pending Ophthalmologist Review',
    imageSrc: '/samples/sample-2-moderate-dr.jpg',
    originalImageSrc: '/samples/sample-2-moderate-dr.jpg',
    timestamp: '2026-09-10T07:55:00.000Z',
    patient: {
      name: 'Harish Bora',
      age: 63,
      gender: 'Male',
      diabetesYears: 16,
      eye: 'OD',
      abhaId: 'ABHA-4190-6721',
    },
    screener: {
      name: 'Anjali Devi',
      operatorId: 'TECH-AS-401',
      centerName: 'Sonitpur Rural Vision Centre / PHC',
    },
    quality: {
      isRetinal: true,
      isGradable: true,
      score: 96,
      status: 'Gradable',
      clarity: 95,
      illumination: 97,
      reasons: [],
    },
    evidence: [
      { name: 'Microaneurysms detected in macula vicinity', confidence: '92%', tone: 'teal' },
      { name: 'Hard exudates', confidence: '86%', tone: 'amber' },
    ],
  },
  {
    id: 'NET-2026-0003',
    caseStatus: 'PENDING_REVIEW',
    level: 'Level 1',
    drLevelNum: 1,
    drClassName: 'Mild DR',
    confidence: '88.4%',
    status: 'Non-referable',
    priority: 'Pending Ophthalmologist Review',
    imageSrc: '/samples/sample-1-mild-dr.jpg',
    originalImageSrc: '/samples/sample-1-mild-dr.jpg',
    timestamp: '2026-09-10T08:15:00.000Z',
    patient: {
      name: 'Priyanka Das',
      age: 46,
      gender: 'Female',
      diabetesYears: 5,
      eye: 'OS',
      abhaId: 'ABHA-3312-8819',
    },
    screener: {
      name: 'Anjali Devi',
      operatorId: 'TECH-AS-401',
      centerName: 'Sonitpur Rural Vision Centre / PHC',
    },
    quality: {
      isRetinal: true,
      isGradable: true,
      score: 97,
      status: 'Gradable',
      clarity: 98,
      illumination: 96,
      reasons: [],
    },
    evidence: [
      { name: 'Isolated microaneurysms in temporal arcade', confidence: '88%', tone: 'teal' },
    ],
  },
];

// Helper to convert DB row to CaseRecord
function mapDbRowToCaseRecord(row: typeof cases.$inferSelect): CaseRecord {
  return {
    id: row.id,
    caseStatus: row.caseStatus as CaseStatus,
    level: row.level,
    drLevelNum: row.drLevelNum as DRClass,
    drClassName: (row.drClassName as any) || undefined,
    confidence: row.confidence,
    status: row.status as 'Referable' | 'Non-referable',
    priority: row.priority as any,
    imageSrc: row.imageSrc,
    originalImageSrc: row.originalImageSrc || undefined,
    gradcamHeatmapSrc: row.gradcamHeatmapSrc || undefined,
    gradcamOverlaySrc: row.gradcamOverlaySrc || undefined,
    timestamp: row.timestamp.toISOString(),
    patient: row.patient || undefined,
    screener: row.screener || undefined,
    quality: row.quality || undefined,
    evidence: row.evidence || undefined,
    ophthalmologistReview: row.ophthalmologistReview || undefined,
  };
}

// ==========================================
// FILE-BASED BACKUP & LOCAL CACHE
// ==========================================
function loadCasesFromFile(): CaseRecord[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading cases file:', err);
  }

  saveCasesToFile(defaultCases);
  return [...defaultCases];
}

function saveCasesToFile(caseList: CaseRecord[]): void {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(caseList, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing cases file:', err);
  }
}

let cachedCases: CaseRecord[] = loadCasesFromFile();
let hasSeededCasesPostgres = false;

async function ensureSeededCasesPostgres() {
  if (!db || hasSeededCasesPostgres) return;
  try {
    const existing = await db.select({ id: cases.id }).from(cases).limit(1);
    if (existing.length === 0) {
      for (const c of defaultCases) {
        await db.insert(cases).values({
          id: c.id,
          caseStatus: c.caseStatus,
          level: c.level,
          drLevelNum: c.drLevelNum,
          drClassName: c.drClassName,
          confidence: c.confidence,
          status: c.status,
          priority: c.priority,
          imageSrc: c.imageSrc,
          originalImageSrc: c.originalImageSrc,
          gradcamHeatmapSrc: c.gradcamHeatmapSrc,
          gradcamOverlaySrc: c.gradcamOverlaySrc,
          timestamp: new Date(c.timestamp),
          patient: c.patient,
          screener: c.screener,
          quality: c.quality,
          evidence: c.evidence,
          ophthalmologistReview: c.ophthalmologistReview,
          createdAt: new Date(),
        });
      }
    }
    hasSeededCasesPostgres = true;
  } catch (err) {
    console.error('Notice: Auto-seeding Neon PostgreSQL cases deferred:', err);
  }
}

/**
 * Generates the next sequential clinical case ID (e.g. NET-2026-0004)
 */
export async function generateNextCaseId(): Promise<string> {
  const allCases = await getCases();
  let maxNum = 0;
  for (const c of allCases) {
    const match = c.id.match(/^NET-2026-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  const nextNum = maxNum + 1;
  return `NET-2026-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Retrieves all cases sorted with most recent first
 */
export async function getCases(): Promise<CaseRecord[]> {
  if (db) {
    try {
      await ensureSeededCasesPostgres();
      const records = await db.select().from(cases).orderBy(desc(cases.createdAt));
      if (records.length > 0) {
        return records.map(mapDbRowToCaseRecord);
      }
    } catch (err) {
      console.warn('Neon DB query error in getCases, falling back to local file store:', err);
    }
  }

  cachedCases = loadCasesFromFile();
  return [...cachedCases];
}

/**
 * Retrieves single case by ID
 */
export async function getCaseById(id: string): Promise<CaseRecord | undefined> {
  if (db) {
    try {
      await ensureSeededCasesPostgres();
      const records = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
      if (records.length > 0) {
        return mapDbRowToCaseRecord(records[0]);
      }
      return undefined;
    } catch (err) {
      console.warn('Neon DB query error in getCaseById:', err);
    }
  }

  const current = await getCases();
  return current.find((c) => c.id === id);
}

/**
 * Adds a new case to database from an AI screening result
 */
export async function addCaseFromScreening(
  result: ScreeningResult,
  patient?: PatientMetadata,
  screener?: ScreenerMetadata,
  initialStatus: CaseStatus = 'PENDING_REVIEW'
): Promise<CaseRecord> {
  const assignedId =
    result.caseId && result.caseId.startsWith('NET-2026-')
      ? result.caseId
      : await generateNextCaseId();

  const newCase: CaseRecord = {
    id: assignedId,
    caseStatus: initialStatus,
    level: `Level ${result.drLevel}`,
    drLevelNum: result.drLevel,
    drClassName: result.drClassName,
    confidence: result.confidenceText,
    status: result.referableStatus,
    priority: initialStatus === 'REVIEWED' ? 'Reviewed' : 'Pending Ophthalmologist Review',
    imageSrc: result.imageSrc,
    originalImageSrc: result.originalImageSrc || result.imageSrc,
    gradcamHeatmapSrc: result.gradcam?.heatmapDataUrl,
    gradcamOverlaySrc: result.gradcam?.overlayDataUrl,
    quality: result.quality,
    evidence: result.evidence,
    timestamp: result.timestamp || new Date().toISOString(),
    patient: patient || {
      name: 'Ramesh Gogoi',
      age: 58,
      gender: 'Male',
      diabetesYears: 12,
      eye: 'OD',
      abhaId: 'ABHA-9821-4402',
    },
    screener: screener || {
      name: 'Anjali Devi',
      operatorId: 'TECH-AS-401',
      centerName: 'Sonitpur Rural Vision Centre / PHC',
    },
  };

  if (db) {
    try {
      await ensureSeededCasesPostgres();
      const existing = await db.select({ id: cases.id }).from(cases).where(eq(cases.id, assignedId)).limit(1);

      if (existing.length > 0) {
        await db.update(cases).set({
          caseStatus: newCase.caseStatus,
          level: newCase.level,
          drLevelNum: newCase.drLevelNum,
          drClassName: newCase.drClassName,
          confidence: newCase.confidence,
          status: newCase.status,
          priority: newCase.priority,
          imageSrc: newCase.imageSrc,
          originalImageSrc: newCase.originalImageSrc,
          gradcamHeatmapSrc: newCase.gradcamHeatmapSrc,
          gradcamOverlaySrc: newCase.gradcamOverlaySrc,
          patient: newCase.patient,
          screener: newCase.screener,
          quality: newCase.quality,
          evidence: newCase.evidence,
        }).where(eq(cases.id, assignedId));
      } else {
        await db.insert(cases).values({
          id: newCase.id,
          caseStatus: newCase.caseStatus,
          level: newCase.level,
          drLevelNum: newCase.drLevelNum,
          drClassName: newCase.drClassName,
          confidence: newCase.confidence,
          status: newCase.status,
          priority: newCase.priority,
          imageSrc: newCase.imageSrc,
          originalImageSrc: newCase.originalImageSrc,
          gradcamHeatmapSrc: newCase.gradcamHeatmapSrc,
          gradcamOverlaySrc: newCase.gradcamOverlaySrc,
          timestamp: new Date(newCase.timestamp),
          patient: newCase.patient,
          screener: newCase.screener,
          quality: newCase.quality,
          evidence: newCase.evidence,
          createdAt: new Date(),
        });
      }
    } catch (err) {
      console.error('Failed to insert case into Neon PostgreSQL, syncing to disk:', err);
    }
  }

  // Also sync locally to cases.json
  const current = loadCasesFromFile();
  const existingIdx = current.findIndex((c) => c.id === assignedId);
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...newCase };
  } else {
    current.unshift(newCase);
    if (current.length > 200) current.pop();
  }
  saveCasesToFile(current);
  cachedCases = current;

  return newCase;
}

/**
 * Submits an ophthalmologist tele-review for a case
 */
export async function submitOphthalmologistReview(
  caseId: string,
  review: {
    finalDRLevel: DRClass;
    clinicalNotes: string;
    reviewerName?: string;
    reviewerRegNo?: string;
    hospitalAffiliation?: string;
    referralRecommendation?: 'Routine 12m' | 'Early 3-6m' | 'Laser / Anti-VEGF Specialist Referral' | 'Emergency Referral';
  }
): Promise<CaseRecord | null> {
  const specialistReview: SpecialistReview = {
    reviewedAt: new Date().toISOString(),
    finalDRLevel: review.finalDRLevel,
    clinicalNotes: review.clinicalNotes,
    reviewerName: review.reviewerName || 'Dr. Rajesh Sharma, MS',
    reviewerRegNo: review.reviewerRegNo || 'NMC-OPH-88421',
    hospitalAffiliation: review.hospitalAffiliation || 'Regional Institute of Ophthalmology',
    referralRecommendation: review.referralRecommendation || (review.finalDRLevel >= 2 ? 'Laser / Anti-VEGF Specialist Referral' : 'Routine 12m'),
  };

  const newLevel = `Level ${review.finalDRLevel}`;
  const newStatus = review.finalDRLevel >= 2 ? 'Referable' : 'Non-referable';

  if (db) {
    try {
      await ensureSeededCasesPostgres();
      const updated = await db
        .update(cases)
        .set({
          drLevelNum: review.finalDRLevel,
          level: newLevel,
          status: newStatus,
          caseStatus: 'REVIEWED',
          priority: 'Reviewed',
          ophthalmologistReview: specialistReview,
        })
        .where(eq(cases.id, caseId))
        .returning();

      if (updated.length > 0) {
        return mapDbRowToCaseRecord(updated[0]);
      }
    } catch (err) {
      console.error('Neon DB update error in submitOphthalmologistReview:', err);
    }
  }

  // Local fallback
  const current = loadCasesFromFile();
  const c = current.find((item) => item.id === caseId);
  if (!c) return null;

  c.drLevelNum = review.finalDRLevel;
  c.level = newLevel;
  c.status = newStatus;
  c.caseStatus = 'REVIEWED';
  c.priority = 'Reviewed';
  c.ophthalmologistReview = specialistReview;

  saveCasesToFile(current);
  cachedCases = current;
  return c;
}

/**
 * Calculates current screening surveillance KPIs
 */
export async function getScreeningStats() {
  const current = await getCases();
  const total = current.length + 21; // Base offset for demo continuity
  const referable = current.filter((c) => c.status === 'Referable').length + 3;
  const pending = current.filter(
    (c) =>
      c.caseStatus === 'PENDING_REVIEW' ||
      c.priority === 'Pending Ophthalmologist Review' ||
      c.priority === 'Pending' ||
      c.priority === 'High priority'
  ).length;
  const ungradable = 2;

  return {
    screenedToday: total,
    referableCases: referable,
    pendingReview: pending,
    ungradable,
  };
}
