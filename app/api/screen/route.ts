import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { runScreeningPipeline } from '@/lib/ai/pipeline';
import { addCaseFromScreening, generateNextCaseId } from '@/lib/db/caseStore';
import { uploadMedicalImage } from '@/lib/upload/cloudinary';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let imageBuffer: Buffer | null = null;
    let originalFilename = 'fundus-image.jpg';

    let patientData: any = undefined;
    let screenerData: any = undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const sampleName = formData.get('sample') as string | null;

      if (formData.get('patientName')) {
        patientData = {
          name: formData.get('patientName') as string,
          age: Number(formData.get('patientAge')) || 58,
          gender: (formData.get('patientGender') as any) || 'Male',
          diabetesYears: Number(formData.get('diabetesDuration')) || 12,
          eye: (formData.get('eyeTested') as any) || 'OD',
          abhaId: (formData.get('abhaId') as string) || undefined,
        };
      }

      if (formData.get('screenerName')) {
        screenerData = {
          name: formData.get('screenerName') as string,
          operatorId: (formData.get('screenerOperatorId') as string) || undefined,
          centerName: (formData.get('screenerCenter') as string) || undefined,
        };
      }

      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        originalFilename = file.name;
      } else if (sampleName) {
        // Load designated sample from public folder
        const samplePath = path.join(process.cwd(), 'public', sampleName.replace(/^\//, ''));
        imageBuffer = await fs.readFile(samplePath);
        originalFilename = sampleName;
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      if (body.patient) patientData = body.patient;
      if (body.screener) screenerData = body.screener;

      if (body.sample) {
        const samplePath = path.join(process.cwd(), 'public', body.sample.replace(/^\//, ''));
        imageBuffer = await fs.readFile(samplePath);
        originalFilename = body.sample;
      } else if (body.imageBase64) {
        const base64Data = body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      }
    }

    // Default fallback to public/netrika-fundus.png if no input provided
    if (!imageBuffer) {
      const fallbackPath = path.join(process.cwd(), 'public', 'netrika-fundus.png');
      imageBuffer = await fs.readFile(fallbackPath);
    }

    // Generate unique sequential case ID (e.g. NET-2026-0004)
    const nextCaseId = await generateNextCaseId();

    // Run complete AI Pipeline
    const result = await runScreeningPipeline(imageBuffer, { caseId: nextCaseId });

    // Upload processed images to Cloudinary (or fallback to data URLs if Cloudinary not set)
    if (result.imageSrc) {
      const uploadedMainUrl = await uploadMedicalImage(
        result.imageSrc,
        'fundus-scans',
        `${nextCaseId}-normalized`
      );
      result.imageSrc = uploadedMainUrl;
      result.originalImageSrc = uploadedMainUrl;
    }

    if (result.gradcam?.heatmapDataUrl) {
      const uploadedHeatmapUrl = await uploadMedicalImage(
        result.gradcam.heatmapDataUrl,
        'gradcam-heatmaps',
        `${nextCaseId}-heatmap`
      );
      result.gradcam.heatmapDataUrl = uploadedHeatmapUrl;
    }

    if (result.gradcam?.overlayDataUrl) {
      const uploadedOverlayUrl = await uploadMedicalImage(
        result.gradcam.overlayDataUrl,
        'gradcam-overlays',
        `${nextCaseId}-overlay`
      );
      result.gradcam.overlayDataUrl = uploadedOverlayUrl;
    }

    // Save into case database with PENDING_REVIEW only if image quality is gradable
    let savedCase = null;
    if (result.quality.isGradable) {
      savedCase = await addCaseFromScreening(result, patientData, screenerData, 'PENDING_REVIEW');
    }

    return NextResponse.json({
      success: true,
      filename: originalFilename,
      data: result,
      case: savedCase,
    });
  } catch (error: any) {
    console.error('Screening API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process retinal screening',
      },
      { status: 500 }
    );
  }
}
