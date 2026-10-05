'use client'

import { useState, useEffect } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Hero } from '@/components/sections/Hero'
import { MobileScreeningShowcase } from '@/components/sections/MobileScreeningShowcase'
import { Workflow } from '@/components/sections/Workflow'
import { ScreeningWorkspace } from '@/components/sections/ScreeningWorkspace'
import { Dashboard } from '@/components/sections/Dashboard'
import { SignInModal } from '@/components/modals/SignInModal'
import { CaseDetailModal } from '@/components/modals/CaseDetailModal'
import type { CaseRecord } from '@/lib/ai/types'
import type { UserProfile } from '@/lib/db/userStore'

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [authOpen, setAuthOpen] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null)

  // Restore saved session from server (/api/auth/me) with localStorage fallback on mount
  useEffect(() => {
    let isMounted = true

    async function checkServerSession() {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (isMounted && data.authenticated && data.user) {
          setUser(data.user)
          localStorage.setItem('netrika_user', JSON.stringify(data.user))
          return
        }
      } catch (err) {
        console.warn('Could not verify server session:', err)
      }

      // LocalStorage fallback
      try {
        const saved = localStorage.getItem('netrika_user')
        if (saved && isMounted) {
          setUser(JSON.parse(saved))
        } else if (isMounted) {
          // Default to Technician for screening role by default
          const defaultTechnician: UserProfile = {
            id: 'usr-tech-01',
            name: 'Anjali Devi',
            email: 'anjali.devi@ruralhealth.gov.in',
            role: 'Technician',
            operatorId: 'TECH-AS-401',
            centerName: 'Sonitpur Rural Vision Centre / PHC',
            district: 'Sonitpur, Assam',
            createdAt: new Date().toISOString(),
          }
          setUser(defaultTechnician)
          localStorage.setItem('netrika_user', JSON.stringify(defaultTechnician))
        }
      } catch (e) {
        console.log('Session restore error:', e)
      }
    }

    checkServerSession()
    return () => {
      isMounted = false
    }
  }, [])

  const handleUserLogin = (u: UserProfile) => {
    setUser(u)
    try {
      localStorage.setItem('netrika_user', JSON.stringify(u))
    } catch (e) {}
  }

  const handleUserLogout = async () => {
    setUser(null)
    try {
      localStorage.removeItem('netrika_user')
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (e) {}
  }

  const handleCaseCreated = () => {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-slate-900 selection:bg-teal-500/20 selection:text-teal-900">
      {/* GLOBAL FLOATING NAVIGATION */}
      <Navbar onSignInClick={() => setAuthOpen(true)} user={user} />

      {/* MAIN SECTIONS */}
      <main>
        <Hero onSignInClick={() => setAuthOpen(true)} user={user} />
        <MobileScreeningShowcase />
        <Workflow />
        <ScreeningWorkspace
          onCaseCreated={handleCaseCreated}
          refreshKey={refreshKey}
          user={user}
        />
        <Dashboard
          refreshKey={refreshKey}
          onSelectCase={(c) => setSelectedCase(c)}
        />
      </main>

      {/* FOOTER */}
      <Footer />

      {/* AUTHENTICATION & ROLE SWITCHER MODAL */}
      <SignInModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        user={user}
        onLogin={handleUserLogin}
        onLogout={handleUserLogout}
      />

      {/* CLINICAL CASE DETAIL & OPHTHALMOLOGIST DOSSIER MODAL */}
      <CaseDetailModal
        caseItem={selectedCase}
        onClose={() => setSelectedCase(null)}
        onReviewSubmitted={handleCaseCreated}
        user={user}
      />
    </div>
  )
}
