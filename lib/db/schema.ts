import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import type {
  DRClass,
  ImageQualityResult,
  EvidenceItem,
  PatientMetadata,
  ScreenerMetadata,
  SpecialistReview,
  CaseStatus,
} from '../ai/types';

// ==========================================
// USERS TABLE
// ==========================================
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<'Technician' | 'Ophthalmologist'>().notNull(),
  phone: text('phone'),
  // Technician specific fields
  operatorId: text('operator_id'),
  centerName: text('center_name'),
  district: text('district'),
  // Ophthalmologist specific fields
  medicalCouncilRegNo: text('medical_council_reg_no'),
  hospitalAffiliation: text('hospital_affiliation'),
  subSpecialty: text('sub_specialty'),
  designation: text('designation'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type UserDbSelect = typeof users.$inferSelect;
export type UserDbInsert = typeof users.$inferInsert;

// ==========================================
// CASES TABLE
// ==========================================
export const cases = pgTable('cases', {
  id: text('id').primaryKey(), // e.g. NET-2026-0001
  caseStatus: text('case_status').$type<CaseStatus>().notNull().default('PENDING_REVIEW'),
  level: text('level').notNull(), // 'Level 1', 'Level 2', etc.
  drLevelNum: integer('dr_level_num').$type<DRClass>().notNull(),
  drClassName: text('dr_class_name'),
  confidence: text('confidence').notNull(),
  status: text('status').$type<'Referable' | 'Non-referable'>().notNull(),
  priority: text('priority').notNull(),
  imageSrc: text('image_src').notNull(),
  originalImageSrc: text('original_image_src'),
  gradcamHeatmapSrc: text('gradcam_heatmap_src'),
  gradcamOverlaySrc: text('gradcam_overlay_src'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  patient: jsonb('patient').$type<PatientMetadata>(),
  screener: jsonb('screener').$type<ScreenerMetadata>(),
  quality: jsonb('quality').$type<ImageQualityResult>(),
  evidence: jsonb('evidence').$type<EvidenceItem[]>(),
  ophthalmologistReview: jsonb('ophthalmologist_review').$type<SpecialistReview>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CaseDbSelect = typeof cases.$inferSelect;
export type CaseDbInsert = typeof cases.$inferInsert;
