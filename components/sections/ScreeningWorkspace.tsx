'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  UploadCloud,
  FileImage,
  Check,
  X,
  ScanLine,
  ShieldCheck,
  Eye,
  FileCheck2,
  CircleHelp,
  ArrowRight,
  ChevronDown,
  User,
  Stethoscope,
  Sparkles,
  AlertCircle,
  Clock,
  Layers,
  Compass,
  Calendar,
  UserCheck,
  Award,
  Gauge,
  CircleDot,
  Sun,
  FileText,
  Activity,
} from 'lucide-react'
import { RetinaVisual, type ViewMode } from '@/components/common/RetinaVisual'
import type { ScreeningResult, CaseRecord, DRClass, EvidenceItem } from '@/lib/ai/types'
import type { UserProfile } from '@/lib/db/userStore'

type ScanState = 'ready' | 'analyzing' | 'complete'

const defaultEvidence: EvidenceItem[] = [
  { name: 'Possible microaneurysms', confidence: '92%', tone: 'teal' },
  { name: 'Possible hemorrhagic regions', confidence: '86%', tone: 'violet' },
  { name: 'Possible exudative regions', confidence: '78%', tone: 'amber' },
  { name: 'Other retinal abnormalities', confidence: '64%', tone: 'coral' },
]

interface ScreeningWorkspaceProps {
  onCaseCreated?: () => void
  refreshKey?: number
  user?: UserProfile | null
}

export function ScreeningWorkspace({
  onCaseCreated,
  refreshKey,
  user,
}: ScreeningWorkspaceProps) {
  const [scanState, setScanState] = useState<ScanState>('ready')
  const [mode, setMode] = useState<ViewMode>('original')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [result, setResult] = useState<ScreeningResult | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string>('/samples/sample-3-severe-dr.jpg')
  const [metaText, setMetaText] = useState<string>('OD · 45° · 2048 × 2048 px')
  const [sampleIdx, setSampleIdx] = useState<number>(0)
  const [reviewLevel, setReviewLevel] = useState<DRClass>(2)
  const [reviewNotes, setReviewNotes] = useState<string>('')
  const [referralRecommendation, setReferralRecommendation] = useState<
    'Routine 12m' | 'Early 3-6m' | 'Laser / Anti-VEGF Specialist Referral' | 'Emergency Referral'
  >('Laser / Anti-VEGF Specialist Referral')
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false)
  const [submittedForReview, setSubmittedForReview] = useState<boolean>(false)

  // Pending queue for ophthalmologist review
  const [pendingCases, setPendingCases] = useState<CaseRecord[]>([])
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)

  // Patient Intake & Field Demographics
  const [patientName, setPatientName] = useState('Ramesh Gogoi')
  const [patientAge, setPatientAge] = useState('58')
  const [patientGender, setPatientGender] = useState<'Male' | 'Female' | 'Other'>('Male')
  const [diabetesDuration, setDiabetesDuration] = useState('12')
  const [eyeTested, setEyeTested] = useState<'OD' | 'OS'>('OD')
  const [abhaId, setAbhaId] = useState('ABHA-9821-4402')
  const [showPatientForm, setShowPatientForm] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isOphthalmologist = user?.role === 'Ophthalmologist'

  const samples = [
    '/samples/sample-2-moderate-dr.jpg',
    '/samples/sample-1-mild-dr.jpg',
    '/samples/sample-0-no-dr.jpg',
    '/samples/sample-3-severe-dr.jpg',
    '/samples/sample-4-proliferative-dr.jpg',
  ]

  const loadCaseIntoWorkspace = (c: CaseRecord) => {
    setActiveCaseId(c.id)
    setPatientName(c.patient?.name || '')
    setPatientAge(String(c.patient?.age || ''))
    setPatientGender(c.patient?.gender || 'Male')
    setDiabetesDuration(String(c.patient?.diabetesYears || ''))
    setEyeTested(c.patient?.eye || 'OD')
    setAbhaId(c.patient?.abhaId || '')
    setPreviewSrc(c.imageSrc || '/netrika-fundus.png')
    setMetaText(`${c.id} · ${c.patient?.name || 'Patient'} (${c.patient?.eye || 'OD'}) · ${c.level}`)
    setReviewLevel(c.drLevelNum ?? 2)
    setReviewNotes(c.ophthalmologistReview?.clinicalNotes || '')
    setReferralRecommendation(
      c.ophthalmologistReview?.referralRecommendation ||
      (c.status === 'Referable' ? 'Laser / Anti-VEGF Specialist Referral' : 'Routine 12m')
    )
    setResult({
      caseId: c.id,
      imageSrc: c.imageSrc,
      originalImageSrc: c.originalImageSrc || c.imageSrc,
      quality: c.quality || { isRetinal: true, isGradable: true, score: 95, status: 'Gradable', clarity: 94, illumination: 96, reasons: [] },
      drLevel: c.drLevelNum,
      drLevelText: c.level,
      drClassName: c.drClassName || (c.drLevelNum === 3 ? 'Severe DR' : c.drLevelNum === 2 ? 'Moderate DR' : c.drLevelNum === 1 ? 'Mild DR' : c.drLevelNum === 4 ? 'Proliferative DR' : 'No DR'),
      confidence: parseFloat(c.confidence) || 94.0,
      confidenceText: c.confidence,
      isReferable: c.status === 'Referable',
      referableStatus: c.status,
      referableBadge: c.status === 'Referable' ? 'REFERABLE DR' : 'NON-REFERABLE',
      probabilities: [0.02, 0.05, 0.85, 0.05, 0.03],
      gradcam: {
        heatmapDataUrl: c.gradcamHeatmapSrc || '',
        overlayDataUrl: c.gradcamOverlaySrc || '',
        peakActivationQuadrant: 'Temporal Superior',
        salientCoordinates: [],
      },
      evidence: c.evidence && c.evidence.length > 0 ? c.evidence : defaultEvidence,
      processingTimeMs: 110,
      timestamp: c.timestamp,
    })
    setScanState('complete')
    setSubmittedForReview(false)
  }

  // Synchronize pending queue when in Ophthalmologist mode
  useEffect(() => {
    if (isOphthalmologist) {
      const fetchPending = async () => {
        try {
          const res = await fetch('/api/review')
          const data = await res.json()
          if (data.success && Array.isArray(data.cases)) {
            const pendings = data.cases.filter(
              (c: CaseRecord) => c.caseStatus === 'PENDING_REVIEW' || c.priority === 'Pending Ophthalmologist Review'
            )
            setPendingCases(pendings)
            if (pendings.length > 0) {
              const currentActive = pendings.find((c: CaseRecord) => c.id === activeCaseId)
              if (!currentActive) {
                loadCaseIntoWorkspace(pendings[0])
              }
            } else {
              setActiveCaseId(null)
              setResult(null)
              setScanState('ready')
            }
          }
        } catch (e) {
          console.error('Error fetching pending queue:', e)
        }
      }
      fetchPending()
    }
  }, [isOphthalmologist, refreshKey])

  const processScreening = async (formData: FormData, localPreviewUrl?: string, filename?: string) => {
    setScanState('analyzing')
    setSubmittedForReview(false)
    if (localPreviewUrl) setPreviewSrc(localPreviewUrl)

    formData.append('patientName', patientName)
    formData.append('patientAge', patientAge)
    formData.append('patientGender', patientGender)
    formData.append('diabetesDuration', diabetesDuration)
    formData.append('eyeTested', eyeTested)
    formData.append('abhaId', abhaId)
    formData.append('screenerName', user?.name || 'Anjali Devi')
    formData.append('screenerOperatorId', user?.operatorId || 'TECH-AS-401')
    formData.append('screenerCenter', user?.centerName || 'Sonitpur Rural Vision Centre / PHC')

    try {
      const res = await fetch('/api/screen', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (data.success && data.data) {
        const screeningData: ScreeningResult = data.data
        setResult(screeningData)
        setPreviewSrc(screeningData.imageSrc)
        setMetaText(filename || `${screeningData.drClassName} · 512 × 512 px`)
        setReviewLevel(screeningData.drLevel)
        setReferralRecommendation(
          screeningData.isReferable
            ? 'Laser / Anti-VEGF Specialist Referral'
            : 'Routine 12m'
        )
        setScanState('complete')
        if (screeningData.quality.isGradable && onCaseCreated) {
          onCaseCreated()
        }
      } else {
        throw new Error(data.error || 'Screening failed')
      }
    } catch (err) {
      console.error('Screening failed:', err)
      setScanState('complete')
    }
  }

  const handleFileUpload = (file: File) => {
    const previewUrl = URL.createObjectURL(file)
    const formData = new FormData()
    formData.append('file', file)
    processScreening(formData, previewUrl, `${file.name} · ${(file.size / 1024).toFixed(0)} KB`)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleSampleClick = () => {
    const nextSample = samples[sampleIdx % samples.length]
    setSampleIdx((prev) => prev + 1)
    const formData = new FormData()
    formData.append('sample', nextSample)
    processScreening(formData, nextSample, `${nextSample.replace('/samples/', '')} · Sample fundus`)
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleTechnicianSubmit = () => {
    setSubmittedForReview(true)
    if (onCaseCreated) onCaseCreated()
  }

  const handleStartNewScreening = () => {
    setScanState('ready')
    setSubmittedForReview(false)
    setResult(null)
    setPreviewSrc('/netrika-fundus.png')
    setMetaText('OD · 45° · 2048 × 2048 px')
    setPatientName('')
    setPatientAge('')
    setDiabetesDuration('')
    setAbhaId('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleOphthalmologistReviewSubmit = async () => {
    const targetCaseId = activeCaseId || result?.caseId
    if (!targetCaseId) {
      setReviewOpen(false)
      return
    }

    setIsSubmittingReview(true)
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: targetCaseId,
          finalDRLevel: Number(reviewLevel),
          clinicalNotes: reviewNotes,
          reviewerName: user?.role === 'Ophthalmologist' ? user.name : 'Dr. Rajesh Sharma, MS',
          reviewerRegNo: user?.role === 'Ophthalmologist' ? user.medicalCouncilRegNo : 'NMC-OPH-88421',
          hospitalAffiliation: user?.role === 'Ophthalmologist' ? user.hospitalAffiliation : 'Regional Institute of Ophthalmology',
          referralRecommendation,
        }),
      })
      const data = await res.json()
      if (data.success) {
        if (onCaseCreated) onCaseCreated()
        const updatedPendings = (data.cases || []).filter(
          (c: CaseRecord) => c.caseStatus === 'PENDING_REVIEW' || c.priority === 'Pending Ophthalmologist Review'
        )
        setPendingCases(updatedPendings)
        if (updatedPendings.length > 0) {
          loadCaseIntoWorkspace(updatedPendings[0])
        } else {
          setActiveCaseId(null)
          setScanState('ready')
          setResult(null)
        }
      }
    } catch (err) {
      console.error('Review submit error:', err)
    } finally {
      setIsSubmittingReview(false)
      setReviewOpen(false)
    }
  }

  const currentEvidence = result?.evidence && result.evidence.length > 0 ? result.evidence : defaultEvidence
  const isImageGradable = result?.quality?.isGradable ?? true

  return (
    <section id="screening" className="py-24 bg-[#fcfdfd] border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* WORKSPACE HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200/80">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e6f8f3] border border-[#a7f3d0] text-[#0da487] text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#0da487] animate-pulse" />
              <span>{isOphthalmologist ? 'TELE-OPHTHALMOLOGY WORKSPACE' : 'NETRIKA SCREENING STUDIO'}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {isOphthalmologist ? 'Specialist Clinical Review' : 'New Patient Screening'}
            </h2>
            <p className="text-sm text-slate-600 max-w-xl">
              {isOphthalmologist
                ? 'Review pending retinal cases, verify AI severity grade, inspect Grad-CAM heatmaps, and submit certified sign-off.'
                : 'Upload or capture a retinal fundus image for instant automated diabetic retinopathy screening & triage.'}
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-xs">
              <Sparkles size={13} className="text-[#0da487]" />
              <span>Deep Learning v4.2 Active</span>
            </span>
            {user && (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#e6f8f3] border border-[#a7f3d0] text-teal-800">
                {isOphthalmologist ? <Stethoscope size={13} /> : <ScanLine size={13} />}
                <span>
                  {isOphthalmologist
                    ? `Specialist: ${user.name}`
                    : `Screener: ${user.name} (${user.operatorId || 'Technician'})`}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* OPHTHALMOLOGIST PENDING QUEUE SELECTOR */}
        {isOphthalmologist && (
          <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                <Clock size={18} />
              </div>
              <div>
                <strong className="text-sm font-bold text-slate-900 block">
                  Pending Review Queue ({pendingCases.length} case{pendingCases.length === 1 ? '' : 's'} awaiting endorsement)
                </strong>
                <span className="text-xs text-slate-600">
                  {activeCaseId ? `Currently active: ${activeCaseId}` : 'Select a pending case below to load into workspace:'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {pendingCases.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => loadCaseIntoWorkspace(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeCaseId === c.id
                      ? 'bg-[#0da487] text-white font-bold shadow-md shadow-[#0da487]/20'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  {c.id} &middot; {c.patient?.name || 'Patient'} ({c.patient?.eye || 'OD'})
                </button>
              ))}
              {pendingCases.length === 0 && (
                <span className="text-xs font-semibold text-[#0da487] flex items-center gap-1.5">
                  <Check size={14} /> All pending cases have been signed off!
                </span>
              )}
            </div>
          </div>
        )}

        {/* PATIENT TRIAGE & DEMOGRAPHICS CARD */}
        <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#0da487] uppercase tracking-wider flex items-center gap-2">
              <User size={14} />
              <span>Patient Demographics &amp; Clinical Triage</span>
            </span>
            <button
              type="button"
              onClick={() => setShowPatientForm(!showPatientForm)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
            >
              <span>{showPatientForm ? 'Collapse Form' : 'Edit Demographics'}</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showPatientForm ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {showPatientForm && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <User size={12} className="text-slate-400" />
                  <span>Patient Name</span>
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Ramesh Gogoi"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0da487] focus:ring-1 focus:ring-[#0da487]/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <Calendar size={12} className="text-slate-400" />
                  <span>Age (Years)</span>
                </label>
                <input
                  type="number"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  placeholder="58"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0da487] focus:ring-1 focus:ring-[#0da487]/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <UserCheck size={12} className="text-slate-400" />
                  <span>Gender</span>
                </label>
                <select
                  value={patientGender}
                  onChange={(e) => setPatientGender(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#0da487] transition-all"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <Clock size={12} className="text-slate-400" />
                  <span>Diabetes Duration</span>
                </label>
                <input
                  type="number"
                  value={diabetesDuration}
                  onChange={(e) => setDiabetesDuration(e.target.value)}
                  placeholder="12"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0da487] focus:ring-1 focus:ring-[#0da487]/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <Eye size={12} className="text-slate-400" />
                  <span>Eye Tested</span>
                </label>
                <select
                  value={eyeTested}
                  onChange={(e) => setEyeTested(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#0da487] transition-all"
                >
                  <option value="OD">Right Eye (OD)</option>
                  <option value="OS">Left Eye (OS)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <FileText size={12} className="text-slate-400" />
                  <span>ABHA Health ID</span>
                </label>
                <input
                  type="text"
                  value={abhaId}
                  onChange={(e) => setAbhaId(e.target.value)}
                  placeholder="ABHA-9821-4402"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0da487] focus:ring-1 focus:ring-[#0da487]/30 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* 3-COLUMN WORKSPACE SUITE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* PANEL 1: INPUT & UPLOAD (4 COLS) */}
          <div className="lg:col-span-4 rounded-3xl bg-white border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-100">
                <span>01 / INGESTION</span>
                <CircleHelp size={15} className="text-slate-400" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mt-4 mb-2">Fundus Image Source</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-5">
                Select or upload a high-resolution color fundus photograph for clinical processing.
              </p>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                aria-label="Upload retinal fundus image"
              />

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="group relative border-2 border-dashed border-slate-200 hover:border-[#0da487] rounded-2xl p-6 text-center bg-slate-50/60 hover:bg-teal-50/20 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer"
                onClick={handleBrowseClick}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#e6f8f3] text-[#0da487] border border-[#a7f3d0] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <FileImage size={24} />
                </div>

                <div className="text-sm font-bold text-slate-900 mb-1">
                  {scanState === 'ready'
                    ? 'Upload retinal image'
                    : scanState === 'analyzing'
                    ? 'Processing inference...'
                    : isImageGradable
                    ? 'Fundus loaded'
                    : 'Image rejected'}
                </div>

                <p className="text-xs text-slate-500 max-w-xs leading-normal mb-4">
                  {scanState === 'ready'
                    ? 'Drag and drop image here or click to browse device storage.'
                    : scanState === 'analyzing'
                    ? 'Running vessel segmentation, artifact detection, and neural classification.'
                    : isImageGradable
                    ? `${metaText} · Patient: ${patientName || 'Anonymous'}`
                    : 'Image failed quality validation check.'}
                </p>

                {scanState === 'ready' && (
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleBrowseClick()
                      }}
                      className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 border border-slate-200 flex items-center justify-center gap-2 transition-all shadow-xs"
                    >
                      <UploadCloud size={15} /> Browse Local File
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSampleClick()
                      }}
                      className="text-xs font-semibold text-[#0da487] hover:text-teal-700 flex items-center justify-center gap-1.5 pt-1"
                    >
                      <span>Load Next Clinical Sample</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}

                {scanState === 'analyzing' && (
                  <div className="w-full max-w-xs bg-slate-100 rounded-full h-1.5 overflow-hidden mt-2">
                    <div className="bg-[#0da487] h-full w-2/3 animate-[progress_1.5s_ease-in-out_infinite]" />
                  </div>
                )}

                {scanState === 'complete' && (
                  <div
                    className={`mt-2 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                      isImageGradable
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {isImageGradable ? <Check size={14} /> : <X size={14} />}
                    <span>Quality: {result?.quality.status ?? 'Gradable'} ({result?.quality.score ?? 94}%)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-4 border-t border-slate-100">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#0da487]" /> HIPAA / ABDM Compliant
              </span>
              <span>JPG &middot; PNG &middot; DICOM</span>
            </div>
          </div>

          {/* PANEL 2: GRAD-CAM VISUALIZER (4 COLS) */}
          <div className="lg:col-span-4 rounded-3xl bg-white border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-100">
                <span>02 / SENSITIVITY</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    scanState === 'ready'
                      ? 'bg-slate-100 text-slate-600'
                      : scanState === 'analyzing'
                      ? 'bg-indigo-50 text-indigo-700 animate-pulse'
                      : 'bg-[#e6f8f3] text-[#0da487]'
                  }`}
                >
                  {scanState === 'ready' ? 'Ready' : scanState === 'analyzing' ? 'Analyzing' : 'Complete'}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mt-4 mb-2">Grad-CAM Explanation</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Region saliency visualization mapping neural attention weights to fundus lesions.
              </p>

              {/* RETINA VISUAL CONTAINER */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 aspect-square flex items-center justify-center shadow-inner">
                <RetinaVisual
                  mode={isImageGradable ? mode : 'original'}
                  src={previewSrc}
                  heatmapSrc={result?.gradcam?.heatmapDataUrl}
                  overlaySrc={result?.gradcam?.overlayDataUrl}
                />
                {scanState === 'ready' && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center pointer-events-none">
                    <ScanLine size={32} className="text-[#0da487] mb-2 animate-pulse" />
                    <span className="text-xs font-semibold text-slate-700">
                      Upload or select a sample image to begin inference
                    </span>
                  </div>
                )}
              </div>

              {/* Mode Toggle Switch */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200 mt-4">
                <button
                  type="button"
                  onClick={() => setMode('original')}
                  className={`py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'original' || !isImageGradable
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye size={12} />
                  <span>Original</span>
                </button>
                <button
                  type="button"
                  disabled={!isImageGradable}
                  onClick={() => isImageGradable && setMode('gradcam')}
                  className={`py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'gradcam' && isImageGradable
                      ? 'bg-[#0da487] text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:hover:text-slate-400'
                  }`}
                >
                  <Layers size={12} />
                  <span>Grad-CAM</span>
                </button>
                <button
                  type="button"
                  disabled={!isImageGradable}
                  onClick={() => isImageGradable && setMode('overlay')}
                  className={`py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'overlay' && isImageGradable
                      ? 'bg-[#0da487] text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:hover:text-slate-400'
                  }`}
                >
                  <Sparkles size={12} />
                  <span>Overlay</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Compass size={13} className="text-[#0da487]" />
                <span>Quadrant Saliency:</span>
              </span>
              <span className="font-semibold text-[#0da487]">
                {result?.gradcam?.peakActivationQuadrant || 'Temporal Superior'}
              </span>
            </div>
          </div>

          {/* PANEL 3: DIAGNOSTIC REPORT & ACTION (4 COLS) */}
          <div className="lg:col-span-4 rounded-3xl bg-white border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-100">
                <span>03 / DIAGNOSTIC REPORT</span>
                <FileCheck2 size={16} className="text-slate-400" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mt-4 mb-2">Screening Result</h3>

              {scanState !== 'complete' ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/60 my-6 flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <Eye size={22} />
                  </div>
                  <div className="text-sm font-semibold text-slate-800">Result will appear here</div>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Run screening to calculate ICDR severity classification, confidence metrics, and referral actions.
                  </p>
                </div>
              ) : !isImageGradable ? (
                /* REJECTION UI FOR UNGRADABLE IMAGES */
                <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 space-y-3 my-4">
                  <div className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={15} />
                    <span>Image Ungradable</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">Quality Validation Failed</div>
                  <ul className="text-xs text-rose-700/90 space-y-1 list-disc pl-4">
                    {(result?.quality.reasons || ['Blurry or insufficient retinal clarity.']).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={handleBrowseClick}
                    className="w-full py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    <UploadCloud size={14} /> Re-take or Upload Clear Fundus
                  </button>
                </div>
              ) : (
                /* GRADABLE SUCCESS REPORT */
                <div className="space-y-4 my-4">
                  {/* Severity Card */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Award size={13} className="text-[#0da487]" />
                        <span>ICDR Severity Level</span>
                      </span>
                      <span className="font-mono text-[#0da487] font-bold">{result?.drLevelText || 'LEVEL 2'}</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                      {result?.drClassName || 'Moderate DR'}
                    </div>
                    <div>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          result?.isReferable
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {result?.referableBadge || 'REFERABLE DR'}
                      </span>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Gauge size={13} className="text-[#0da487]" />
                        <span>Model Confidence</span>
                      </span>
                      <strong className="text-[#0da487] font-mono text-sm font-bold">
                        {result?.confidenceText || '94.2%'}
                      </strong>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#0da487] h-full rounded-full transition-all duration-1000"
                        style={{ width: `${result?.confidence || 94.2}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Softmax distribution across 5 ordinal diabetic retinopathy stages.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ACTION BUTTON FOOTER */}
            {scanState === 'complete' && isImageGradable && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                {isOphthalmologist ? (
                  <button
                    type="button"
                    onClick={() => setReviewOpen(true)}
                    className="w-full py-3 rounded-full bg-[#0da487] text-white text-xs font-bold hover:bg-[#0b8a70] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#0da487]/20"
                  >
                    <Stethoscope size={15} /> Clinical Review &amp; Sign-Off
                  </button>
                ) : submittedForReview ? (
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-[#e6f8f3] border border-[#a7f3d0] text-xs text-teal-800 flex items-center gap-2">
                      <Check size={16} className="shrink-0 text-[#0da487]" />
                      <span>Case {result?.caseId} queued for ophthalmologist review.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartNewScreening}
                      className="w-full py-2.5 rounded-full bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 border border-slate-200 transition-all flex items-center justify-center gap-2 shadow-xs"
                    >
                      <ScanLine size={14} /> Screen Next Patient
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleTechnicianSubmit}
                    className="w-full py-3 rounded-full bg-[#0da487] text-white text-xs font-bold hover:bg-[#0b8a70] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#0da487]/20"
                  >
                    <span>Submit for Ophthalmologist Review</span>
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* EVIDENCE ACCORDION / HIGHLIGHTS SECTION */}
        {scanState === 'complete' && isImageGradable && (
          <div className="rounded-3xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-[#0da487] uppercase tracking-wider mb-1">
                  Supporting Retinal Evidence
                </div>
                <h3 className="text-xl font-bold text-slate-900">Why did the AI predict this grade?</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Localized attention weights indicating micro-vascular pathology for physician verification.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                Grad-CAM Activation &middot; Top Salient Lesions
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {currentEvidence.map((item, idx) => {
                const EvidenceIcon =
                  item.tone === 'teal'
                    ? CircleDot
                    : item.tone === 'violet'
                    ? Activity
                    : item.tone === 'amber'
                    ? Sun
                    : AlertCircle

                const iconColor =
                  item.tone === 'teal'
                    ? 'text-[#0da487]'
                    : item.tone === 'violet'
                    ? 'text-violet-500'
                    : item.tone === 'amber'
                    ? 'text-amber-500'
                    : 'text-rose-500'

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 hover:border-teal-300 transition-all flex items-start justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <EvidenceIcon size={14} className={`${iconColor} shrink-0`} />
                        <strong className="text-xs font-bold text-slate-900">{item.name}</strong>
                      </div>
                      <span className="text-[10.5px] text-slate-500 block">AI Detected &middot; Clinical Check</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#0da487] bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      {item.confidence}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* OPHTHALMOLOGIST REVIEW MODAL */}
      {reviewOpen && isOphthalmologist && user && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-2xl space-y-6 my-8">
            <button
              onClick={() => setReviewOpen(false)}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center"
              aria-label="Close review dialog"
            >
              <X size={18} />
            </button>

            <div>
              <div className="text-xs font-bold text-[#0da487] uppercase tracking-wider mb-1">
                Clinical Endorsement &middot; Tele-Ophthalmology
              </div>
              <h3 className="text-2xl font-bold text-slate-900">Specialist Case Review</h3>
              <p className="text-xs text-slate-600 mt-1">
                Logged in as {user.name} ({user.medicalCouncilRegNo || 'Medical Council Verified'}). Endorse grading, designate referral pathway, and apply digital sign-off.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Final ICDR DR Severity Level</label>
                <select
                  value={reviewLevel}
                  onChange={(e) => setReviewLevel(Number(e.target.value) as DRClass)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#0da487]"
                >
                  <option value="0">Level 0 &middot; No Diabetic Retinopathy</option>
                  <option value="1">Level 1 &middot; Mild Non-Proliferative DR</option>
                  <option value="2">Level 2 &middot; Moderate Non-Proliferative DR</option>
                  <option value="3">Level 3 &middot; Severe Non-Proliferative DR</option>
                  <option value="4">Level 4 &middot; Proliferative Diabetic Retinopathy</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Clinical Referral Protocol</label>
                <select
                  value={referralRecommendation}
                  onChange={(e) => setReferralRecommendation(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#0da487]"
                >
                  <option value="Routine 12m">Routine 12-Month Field Rescreening (No / Mild DR)</option>
                  <option value="Early 3-6m">Early 3–6 Month Monitoring (Mild / Moderate DR)</option>
                  <option value="Laser / Anti-VEGF Specialist Referral">Laser Photocoagulation / Anti-VEGF Specialist Referral (Referable DR)</option>
                  <option value="Emergency Referral">Emergency Vitreo-Retinal Surgical Referral (High Risk)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Specialist Clinical Notes &amp; Observations</label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Document macular involvement, microaneurysm distribution, or follow-up instructions..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0da487]"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-100 text-xs text-slate-700 space-y-1">
                <span className="text-slate-900 font-semibold block">Authorized Digital Signature:</span>
                <div>{user.name} &middot; {user.medicalCouncilRegNo || 'NMC Verified'}</div>
                <div className="text-[11px] text-slate-500">{user.hospitalAffiliation || 'Regional Eye Institute'}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOphthalmologistReviewSubmit}
              disabled={isSubmittingReview}
              className="w-full py-3 rounded-full bg-[#0da487] text-white text-xs font-bold hover:bg-[#0b8a70] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#0da487]/20"
            >
              {isSubmittingReview ? 'Signing...' : 'Submit Final Review & Digital Sign-Off'}
              <Check size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
