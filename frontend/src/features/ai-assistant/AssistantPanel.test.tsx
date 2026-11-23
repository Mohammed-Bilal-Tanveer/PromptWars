import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { AssistantPanel } from './index'

vi.mock('@/services', async (orig) => {
  const real: any = await orig()
  return {
    ...real,
    projectService: {
      ...real.projectService,
      assistant: async () => ({
        reply: 'Try the <b>Robotics Lab</b>.', source: 'deterministic',
        references: [{ type: 'equipment', id: 'eq-arduino', label: 'Arduino' }],
        suggested_actions: [{ label: 'Open scheduling', action: 'open_scheduling', params: {} }],
      }),
    },
  }
})

describe('AssistantPanel', () => {
  it('renders the reply as plain text with source badge, refs and actions', async () => {
    const u = userEvent.setup()
    renderWithProviders(<AssistantPanel />)
    await u.click(screen.getByRole('button', { name: /embedded systems/i }))
    expect(await screen.findByText('Try the <b>Robotics Lab</b>.')).toBeInTheDocument()
    expect(screen.getByText('Rule-based answer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Arduino' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open scheduling' })).toBeInTheDocument()
  })
})
