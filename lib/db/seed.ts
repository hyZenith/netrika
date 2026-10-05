import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { defaultUsers } from './userStore';
import { defaultCases } from './caseStore';
import { hashPassword } from '../auth/password';

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
    console.error('ERROR: DATABASE_URL is not set or invalid in .env');
    process.exit(1);
  }

  console.log('Connecting to Neon PostgreSQL database...');
  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  console.log('Seeding initial clinical users...');
  for (const user of defaultUsers) {
    const hashedPassword = await hashPassword(user.passwordHash);
    await db
      .insert(schema.users)
      .values({
        id: user.id,
        name: user.name,
        email: user.email.toLowerCase(),
        passwordHash: hashedPassword,
        role: user.role,
        phone: user.phone,
        operatorId: user.operatorId,
        centerName: user.centerName,
        district: user.district,
        medicalCouncilRegNo: user.medicalCouncilRegNo,
        hospitalAffiliation: user.hospitalAffiliation,
        subSpecialty: user.subSpecialty,
        designation: user.designation,
        createdAt: new Date(user.createdAt),
      })
      .onConflictDoNothing();
  }
  console.log(`Seeded ${defaultUsers.length} clinical users.`);

  console.log('Seeding initial demo cases...');
  for (const c of defaultCases) {
    await db
      .insert(schema.cases)
      .values({
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
      })
      .onConflictDoNothing();
  }
  console.log(`Seeded ${defaultCases.length} demo cases.`);

  console.log('Neon PostgreSQL database successfully seeded!');
}

seed().catch((err) => {
  console.error('Database seeding failed:', err);
  process.exit(1);
});
