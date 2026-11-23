import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { useAppStore } from '@/stores/appStore'
import { GuidedDemo, TOUR_STEPS } from './GuidedDemo'

describe('GuidedDemo', () => {
  it('has 10 steps, shows progress, navigates, exits and makes no mutation calls', () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    expect(TOUR_STEPS).toHaveLength(10)
    useAppStore.getState().setGuidedDemoOpen(true)
    renderWithProviders(<GuidedDemo />)
    expect(screen.getByText('Step 1 of 10')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByText('Step 2 of 10')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Step 9:/ }))
    expect(screen.getByText('Step 9 of 10')).toBeInTheDocument()
    expect(screen.getByText(/never submits, approves, rejects, cancels or resets/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Exit tour/ }))
    expect(useAppStore.getState().guidedDemoOpen).toBe(false)
    const mutating = fetchSpy.mock.calls.filter(([, init]) => init && init.method && init.method !== 'GET')
    expect(mutating).toHaveLength(0)
    vi.unstubAllGlobals()
  })
})
