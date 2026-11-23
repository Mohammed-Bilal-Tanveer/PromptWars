import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { ConnectionIndicator, ModeSwitch } from './ProfessionalLayout'
import { useConnectionStore } from '@/features/connection/connectionStore'

describe('ModeSwitch', () => {
  it('marks Professional Mode current and links to 3D Campus Mode', () => {
    render(<MemoryRouter><ModeSwitch /></MemoryRouter>)
    expect(screen.getByText(/Professional/).closest('[aria-current="page"]')).toBeTruthy()
    expect(screen.getByRole('link', { name: /3D Campus Mode/ }).getAttribute('href')).toBe('/campus-3d')
  })
})

describe('ConnectionIndicator', () => {
  beforeEach(() => useConnectionStore.setState({ state: 'checking' }))
  it.each([['connected', 'Connected'], ['waking', 'Waking up…'], ['unavailable', 'Unavailable']] as const)('shows %s as text', (state, text) => {
    useConnectionStore.setState({ state })
    render(<ConnectionIndicator />)
    expect(screen.getByRole('status').textContent).toContain(text)
  })
})
