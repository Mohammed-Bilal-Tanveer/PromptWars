import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { EquipmentCatalogue } from './index'

const list = vi.fn()
vi.mock('@/services', async (orig) => {
  const actual = await orig<typeof import('@/services')>()
  return {
    ...actual,
    equipmentService: { ...actual.equipmentService, list: (q: unknown) => list(q), categories: vi.fn().mockResolvedValue(['Compute', 'Electronics']) },
    campusService: {
      ...actual.campusService,
      departments: vi.fn().mockResolvedValue([{ id: 'dept-cs', name: 'Computer Science' }]),
      laboratories: vi.fn().mockResolvedValue([]),
    },
  }
})

const item = {
  id: 'eq-gpu-workstation', name: 'GPU Workstation', category: 'Compute', description: '', department_id: 'dept-cs', department_name: 'CS',
  laboratory_id: 'lab-gpu', laboratory_name: 'GPU Lab', capabilities: ['gpu_compute'], quantity_total: 5, quantity_available: 3, status: 'available',
}

describe('EquipmentCatalogue', () => {
  beforeEach(() => {
    list.mockReset()
    list.mockResolvedValue({ items: [item], total: 1, page: 1, page_size: 12 })
  })

  it('uses ?q= initially and passes filters to the service', async () => {
    renderWithProviders(<EquipmentCatalogue />, { route: '/app/discover?q=gpu' })
    expect(await screen.findByText('GPU Workstation')).toBeInTheDocument()
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ q: 'gpu', page: 1, page_size: 12 })))
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'available' } })
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'available' })))
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'name' } })
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'name', status: 'available' })))
  })

  it('shows an empty state', async () => {
    list.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 12 })
    renderWithProviders(<EquipmentCatalogue />)
    expect(await screen.findByText(/No equipment matches/i)).toBeInTheDocument()
  })
})

import { availabilityStatus } from './index'
describe('availabilityStatus', () => {
  it('reports partially_booked when only some units are free', () => {
    expect(availabilityStatus({ status: 'available', quantity_available: 1, quantity_total: 3 })).toBe('partially_booked')
    expect(availabilityStatus({ status: 'available', quantity_available: 3, quantity_total: 3 })).toBe('available')
    expect(availabilityStatus({ status: 'maintenance', quantity_available: 0, quantity_total: 3 })).toBe('maintenance')
  })
})
