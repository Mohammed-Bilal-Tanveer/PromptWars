import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusChip } from './index'

describe('StatusChip', () => {
  it.each([
    ['available', 'Available'], ['partially_booked', 'Partially booked'], ['occupied', 'Fully booked'], ['maintenance', 'Maintenance'],
    ['pending_review', 'Pending review'], ['waitlisted', 'Waitlisted'], ['recommended', 'Recommended'], ['confirmed', 'Confirmed'],
  ])('%s renders icon and text', (status, text) => {
    const { container } = render(<StatusChip status={status} />)
    expect(screen.getByText(text)).toBeTruthy()
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
