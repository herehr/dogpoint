import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Snackbar, Alert } from '@mui/material'
import { useAuth } from '../context/AuthContext'

type Props = {
  /** Inactivity period before auto-logout (ms). Default: 10 minutes */
  ms?: number
  /** Show a warning this long before auto-logout (ms). Default: 60 seconds */
  warnBeforeMs?: number
  /** Where to redirect after logout. Default: "/" */
  redirectTo?: string
}

/**
 * Listens for user activity globally and logs out after a period of inactivity.
 * Works only when a user is authenticated; otherwise it stays idle.
 */
export default function AutoLogout({
  ms = 10 * 60 * 1000,
  warnBeforeMs = 60 * 1000,
  redirectTo = '/',
}: Props) {
  const navigate = useNavigate()
  const { token, logout } = useAuth()
  const isAuthed = !!token

  const [showWarn, setShowWarn] = useState(false)
  const warnTimer = useRef<number | null>(null)
  const logoutTimer = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (warnTimer.current) { window.clearTimeout(warnTimer.current); warnTimer.current = null }
    if (logoutTimer.current) { window.clearTimeout(logoutTimer.current); logoutTimer.current = null }
  }, [])

  const doLogout = useCallback(() => {
    clearTimers()
    logout()
    setShowWarn(false)
    navigate(redirectTo, { replace: true })
  }, [clearTimers, logout, navigate, redirectTo])

  const startTimers = useCallback(() => {
    clearTimers()
    if (!isAuthed) return
    const warnDelay = Math.max(0, ms - warnBeforeMs)
    warnTimer.current = window.setTimeout(() => setShowWarn(true), warnDelay)
    logoutTimer.current = window.setTimeout(() => doLogout(), ms)
  }, [ms, warnBeforeMs, clearTimers, doLogout, isAuthed])

  const onActivity = useCallback(() => {
    if (!isAuthed) return
    setShowWarn(false)
    startTimers()
  }, [startTimers, isAuthed])

  useEffect(() => {
    if (isAuthed) startTimers()

    const evs: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    evs.forEach(e => window.addEventListener(e, onActivity, { passive: true }))

    return () => {
      evs.forEach(e => window.removeEventListener(e, onActivity as any))
      clearTimers()
    }
  }, [onActivity, startTimers, clearTimers, isAuthed])

  return (
    <Snackbar open={showWarn} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert elevation={3} variant="filled" severity="warning" onClose={() => setShowWarn(false)} sx={{ width: '100%' }}>
        Neaktivita zjištěna. Budete automaticky odhlášeni během jedné minuty. Pohněte myší nebo napište, abyste zůstali přihlášeni.
      </Alert>
    </Snackbar>
  )
}