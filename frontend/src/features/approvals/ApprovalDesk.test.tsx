import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { ApprovalDesk } from './index'

const m = vi.hoisted(() => ({ approve: vi.fn(), reject: vi.fn() }))
const req = {
  id: 'r1', project_title: 'Vision rig', requester_name: 'Asha', requester_department_name: 'CS', equipment_name: 'GPU Workstation',
  laboratory_name: 'GPU Lab', equipment_type_id: 'eq-gpu', status: 'pending_review', priority_score: 0.7, requires_supervision: false,
  priority_factors: { deadline_urgency: 0.5, waiting_time: 0.5, fairness: 0.5, preference_fit: 0.5 },
  requested_start_at: '2026-12-01T05:00:00Z', requested_end_at: '2026-12-01T07:00:00Z', purpose: 'Training', timeline: [], booking: null,
  availability_now: { is_available: true, free_units: 2, total_units: 5 }, deadline: null,
}
vi.mock('@/services', async (orig) => {
  const real: any = await orig()
  return {
    ...real,
    campusService: { ...real.campusService, departments: async () => [] },
    equipmentService: { ...real.equipmentService, list: async () => ({ items: [], total: 0, page: 1, page_size: 100 }) },
    bookingService: { ...real.bookingService, getRequest: async () => req },
    approvalService: { queue: async () => ({ items: [req], total: 1, page: 1, page_size: 50 }), approve: m.approve, reject: m.reject, proposeAlternative: vi.fn() },
  }
})

describe('ApprovalDesk', () => {
  it('shows the demo banner and requires a reject reason', async () => {
    const u = userEvent.setup()
    renderWithProviders(<ApprovalDesk />)
    expect(screen.getByText(/simulated reviewer workflow/i)).toBeInTheDocument()
    await u.click(await screen.findByRole('button', { name: /review vision rig/i }))
    await u.click(await screen.findByRole('button', { name: 'Reject' }))
    const dlg = await screen.findByRole('dialog', { name: 'Reject request' })
    await u.click(within(dlg).getByRole('button', { name: /reject request/i }))
    expect(await within(dlg).findByText(/reason of at least 3 characters/i)).toBeInTheDocument()
    expect(m.reject).not.toHaveBeenCalled()
  })

  it('approve calls the service after confirmation', async () => {
    m.approve.mockResolvedValue({ request: req, booking: { id: 'b1', unit_name: 'GPU 1' } })
    const u = userEvent.setup()
    renderWithProviders(<ApprovalDesk />)
    await u.click(await screen.findByRole('button', { name: /review vision rig/i }))
    await u.click(await screen.findByRole('button', { name: 'Approve' }))
    await u.click(await screen.findByRole('button', { name: /approve and confirm/i }))
    await waitFor(() => expect(m.approve).toHaveBeenCalledWith('r1', { note: undefined }))
  })
})
