import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { SchedulingStudio } from './index'

const factors = { deadline_urgency: 0.9, waiting_time: 0.4, fairness: 0.6, preference_fit: 0.5 }
vi.mock('@/services', async (orig) => {
  const real: any = await orig()
  return {
    ...real,
    equipmentService: { ...real.equipmentService, list: async () => ({ items: [{ id: 'eq-gpu', name: 'GPU Workstation' }], total: 1, page: 1, page_size: 100 }) },
    bookingService: { ...real.bookingService, listRequests: async () => ({ items: [{ id: 'r1' }], total: 1, page: 1, page_size: 50 }) },
    schedulingService: {
      conflicts: async () => ({ conflicts: [{ id: 'c1', type: 'pending_overlap', severity: 'high', equipment_type_id: 'eq-gpu', equipment_name: 'GPU Workstation', request_ids: [], booking_ids: [], start_at: '2026-12-01T05:00:00Z', end_at: '2026-12-01T07:00:00Z', message: 'Two requests overlap' }] }),
      recommend: async () => ({
        solver: 'cp-sat', solver_status: 'optimal', solve_time_ms: 42, horizon_days: 7,
        weights: { deadline_urgency: 0.4, waiting_time: 0.25, fairness: 0.2, preference_fit: 0.15 },
        results: [{ request_id: 'r1', equipment_type_id: 'eq-gpu', equipment_name: 'GPU Workstation', allocation_status: 'feasible', recommended: { unit_id: 'u1', unit_name: 'GPU 1', start_at: '2026-12-01T05:00:00Z', end_at: '2026-12-01T07:00:00Z' }, priority_score: 0.72, priority_factors: factors, explanation: ['Deadline is close'], conflicts: [], alternatives: [], assumptions: ['Grid is 15 minutes'] }],
      }),
    },
  }
})

describe('SchedulingStudio', () => {
  it('lists conflicts and renders optimisation results with factor bars and footer', async () => {
    const u = userEvent.setup()
    renderWithProviders(<SchedulingStudio />)
    expect(await screen.findByText('Two requests overlap')).toBeInTheDocument()
    await u.click(await screen.findByRole('button', { name: /optimise pending requests/i }))
    expect(await screen.findByText('Deadline is close')).toBeInTheDocument()
    expect(screen.getByText(/weight 40%/)).toBeInTheDocument()
    expect(screen.getAllByRole('progressbar').length).toBe(4)
    expect(screen.getByTestId('solver-footer')).toHaveTextContent(/nothing is booked automatically/)
  })
})
