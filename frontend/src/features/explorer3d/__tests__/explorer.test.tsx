import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { useExplorerStore } from '../stores/explorerStore'

vi.mock('../scene/Scene', () => ({ default: () => <div data-testid="scene" /> }))

import Explorer3DPage from '../index'

describe('Explorer3DPage', () => {
  afterEach(() => { vi.restoreAllMocks(); useExplorerStore.setState({ panel: null, prevPanel: null }) })

  it('shows the Professional Mode link when WebGL is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null as any)
    renderWithProviders(<Explorer3DPage />)
    const link = screen.getByRole('link', { name: /return to professional mode/i })
    expect(link).toHaveAttribute('href', '/app')
  })

  describe('with WebGL', () => {
    beforeEach(() => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as any)
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    })

    it('renders HUD with exit button and quick action opens a panel', () => {
      renderWithProviders(<Explorer3DPage />)
      expect(screen.getByTestId('scene')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /exit 3d and skip to dashboard/i })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Search' }))
      expect(screen.getByRole('dialog', { name: /search equipment/i })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /close panel/i }))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('Escape opens settings and closes it again', () => {
      renderWithProviders(<Explorer3DPage />)
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.getByRole('dialog', { name: /pause/i })).toBeInTheDocument()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
