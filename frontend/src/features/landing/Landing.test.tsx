import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { Landing } from './index'

vi.mock('@/services', async (orig) => {
  const actual = await orig<typeof import('@/services')>()
  return {
    ...actual,
    analyticsService: { ...actual.analyticsService, overview: vi.fn().mockRejectedValue(new Error('down')) },
    campusService: { ...actual.campusService, departments: vi.fn().mockRejectedValue(new Error('down')) },
  }
})

describe('Landing', () => {
  it('renders both mode links even when the API fails', async () => {
    renderWithProviders(<Landing />)
    expect(screen.getByRole('link', { name: /Professional Mode/i })).toHaveAttribute('href', '/app')
    expect(screen.getByRole('link', { name: /Explore 3D Campus/i })).toHaveAttribute('href', '/campus-3d')
    expect(await screen.findByText(/waking up/i)).toBeInTheDocument()
    expect(screen.getByText(/Your Campus. Your Labs. One Connected World./)).toBeInTheDocument()
  })
})
