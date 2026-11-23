import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { BookingForm } from './BookingForm'

const m = vi.hoisted(() => ({ createRequest: vi.fn(), conflict: false }))
vi.mock('@/hooks/useApi', async (orig) => {
  const real: any = await orig()
  const { ApiError } = await import('@/services/apiClient')
  return {
    ...real,
    useCreateBookingRequest: () => ({
      isPending: false,
      mutate: (_b: unknown, o: any) => {
        m.createRequest(_b)
        o.onError(new ApiError(409, 'SLOT_CONFLICT', 'Slot taken.', { alternatives: [{ equipment_type_id: 'eq-gpu', equipment_name: 'GPU Workstation', unit_id: 'u2', unit_name: 'GPU 2', start_at: '2026-12-01T06:00:00Z', end_at: '2026-12-01T08:00:00Z', reason: 'Next free slot', is_alternative_equipment: false, shift_minutes: 120 }] }))
      },
    }),
  }
})
vi.mock('@/services', async (orig) => {
  const real: any = await orig()
  return {
    ...real,
    campusService: { ...real.campusService, departments: async () => [{ id: 'dept-cs', name: 'Computer Science' }] },
    equipmentService: {
      ...real.equipmentService,
      detail: async () => ({
        id: 'eq-gpu', name: 'GPU Workstation', laboratory_name: 'GPU Lab', min_booking_minutes: 60, max_booking_minutes: 240,
        setup_minutes: 10, cleanup_minutes: 10, requires_supervision: true, units: [],
      }),
      availability: async () => ({ requested: { start_at: '', end_at: '', free_units: 2, is_available: true, reasons: [] } }),
    },
    bookingService: { ...real.bookingService, createRequest: m.createRequest },
  }
})

describe('BookingForm', () => {
  beforeEach(() => m.createRequest.mockReset())

  it('shows constraints and per-field validation messages', async () => {
    const u = userEvent.setup()
    renderWithProviders(<BookingForm equipmentId="eq-gpu" />)
    expect((await screen.findAllByText(/Supervision required/)).length).toBeGreaterThan(0)
    await u.click(screen.getByRole('button', { name: /submit request/i }))
    expect(await screen.findByText(/Enter a project title/)).toBeInTheDocument()
    expect(screen.getByText(/Describe the purpose/)).toBeInTheDocument()
    expect(m.createRequest).not.toHaveBeenCalled()
  })

  it('renders alternatives on SLOT_CONFLICT', async () => {
    const u = userEvent.setup()
    renderWithProviders(<BookingForm equipmentId="eq-gpu" />)
    await screen.findAllByText(/Supervision required/)
    await u.type(screen.getByLabelText('Project title'), 'Vision project')
    await u.type(screen.getByLabelText('Purpose'), 'Train a model')
    await u.click(screen.getByRole('button', { name: /submit request/i }))
    await waitFor(() => expect(screen.getByTestId('conflict-panel')).toBeInTheDocument())
    expect(screen.getByText(/Next free slot/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /use this slot/i })).toBeInTheDocument()
  })
})
