import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { useAppStore } from '@/stores/appStore'
import { ProjectLab } from './index'

const analyse = vi.fn()
vi.mock('@/services', async (orig) => {
  const actual = await orig<typeof import('@/services')>()
  return {
    ...actual,
    projectService: { ...actual.projectService, analyse: (b: unknown) => analyse(b) },
    campusService: { ...actual.campusService, departments: vi.fn().mockResolvedValue([]) },
  }
})

const result = {
  analysis_source: 'demo_fallback', is_fallback: true, fallback_reason: 'OPENAI_API_KEY not configured',
  project_summary: 'Agricultural robot', capabilities: ['computer_vision'], equipment_requirements: [],
  required_lab_capabilities: [], suggested_departments: [], estimated_total_hours: 20, assumptions: ['Two people work on it'],
  safety_considerations: [], clarifying_questions: [], reasoning_summary: '',
  matches: [
    { requirement_name: 'Quantum annealer', priority: 'required', reason: 'Needed', capability_tag: null, match_status: 'unmatched', best: null, candidates: [] },
  ],
}

describe('ProjectLab', () => {
  beforeEach(() => { analyse.mockReset(); useAppStore.setState({ lastAnalysis: null, lastAnalysisInput: null }) })

  it('validates required fields', async () => {
    renderWithProviders(<ProjectLab />)
    fireEvent.click(screen.getByRole('button', { name: /Analyse project/i }))
    expect(await screen.findByText(/Project title is required/)).toBeInTheDocument()
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument()
    expect(analyse).not.toHaveBeenCalled()
  })

  it('shows fallback banner and unmatched requirement honestly', async () => {
    analyse.mockResolvedValue(result)
    renderWithProviders(<ProjectLab />)
    fireEvent.click(screen.getByRole('button', { name: /Use sample project/i }))
    fireEvent.click(screen.getByRole('button', { name: /Analyse project/i }))
    expect(await screen.findByText(/Demo analysis \(deterministic fallback\)/i)).toBeInTheDocument()
    expect(screen.getByText(/OPENAI_API_KEY not configured/)).toBeInTheDocument()
    expect(screen.getByText('No matching equipment in the catalogue')).toBeInTheDocument()
    await waitFor(() => expect(analyse).toHaveBeenCalledWith(expect.objectContaining({ title: 'Autonomous agricultural monitoring robot' })))
  })
})
