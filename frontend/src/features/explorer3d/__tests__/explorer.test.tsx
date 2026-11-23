import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { useExplorerStore } from '../stores/explorerStore'
import { input, playerState } from '../character/playerState'
import { DESTINATIONS, planPath, teleportToDestination } from '../interactions/navigation'

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
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
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

    it('Enter interacts with the nearest object, but not from a button', () => {
      renderWithProviders(<Explorer3DPage />)
      useExplorerStore.setState({ nearest: { id: 'k', type: 'kiosk', position: { x: 0, z: 0 }, radius: 2, label: 'Kiosk', prompt: 'Press E to use' } })
      const btn = screen.getByRole('button', { name: 'Open menu' })
      fireEvent.keyDown(btn, { key: 'Enter' })
      expect(useExplorerStore.getState().panel).toBeNull()
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(useExplorerStore.getState().panel?.kind).toBe('kiosk')
      useExplorerStore.setState({ nearest: null })
    })

    it('menu opens the map panel', () => {
      renderWithProviders(<Explorer3DPage />)
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
      fireEvent.click(screen.getByRole('button', { name: 'Map & Teleport' }))
      expect(screen.getByRole('dialog', { name: /campus map/i })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'CS Building' }))
      expect(screen.getByRole('button', { name: 'Walk there' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Teleport' })).toBeInTheDocument()
    })

    it('Enter and E both interact; neither fires while a panel is open', () => {
      renderWithProviders(<Explorer3DPage />)
      const near = { id: 'k', type: 'kiosk' as const, position: { x: 0, z: 0 }, radius: 2, label: 'Kiosk', prompt: 'Press E to use' }
      useExplorerStore.setState({ nearest: near })
      fireEvent.keyDown(window, { key: 'e' })
      expect(useExplorerStore.getState().panel?.kind).toBe('kiosk')
      useExplorerStore.setState({ panel: null })
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(useExplorerStore.getState().panel?.kind).toBe('kiosk')
      useExplorerStore.setState({ nearest: null, panel: null })
    })

    it('map: select a building then Teleport moves the player to the door', () => {
      useExplorerStore.setState({ reduceMotion: true })
      renderWithProviders(<Explorer3DPage />)
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
      fireEvent.click(screen.getByRole('button', { name: 'Map & Teleport' }))
      fireEvent.click(screen.getByRole('button', { name: 'ECE Building' }))
      fireEvent.click(screen.getByRole('button', { name: 'Teleport' }))
      const d = DESTINATIONS.find((x) => x.id === 'EC-B')!
      expect(playerState.x).toBeCloseTo(d.stand.x)
      expect(useExplorerStore.getState().panel).toBeNull()
    })

    it('resource network tab shows an empty state with a Project Lab link when there is no analysis', () => {
      renderWithProviders(<Explorer3DPage />)
      act(() => useExplorerStore.getState().openPanel({ kind: 'map' }))
      fireEvent.click(screen.getByRole('tab', { name: 'Resource network' }))
      expect(screen.getByText(/no project analysis yet/i)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /open project lab/i }))
      expect(useExplorerStore.getState().panel?.kind).toBe('project')
    })

    it('shows a Professional Mode label in the header', () => {
      renderWithProviders(<Explorer3DPage />)
      expect(screen.getByRole('link', { name: /exit 3d and skip to dashboard/i })).toHaveTextContent(/professional mode/i)
    })

    it('sprint toggle sets run input on touch layouts', () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} }))
      renderWithProviders(<Explorer3DPage />)
      const sp = screen.getByRole('button', { name: 'Sprint' })
      expect(sp).toHaveAttribute('aria-pressed', 'false')
      fireEvent.click(sp)
      expect(input.sprint).toBe(true)
      expect(sp).toHaveAttribute('aria-pressed', 'true')
      fireEvent.click(sp)
      expect(input.sprint).toBe(false)
      vi.unstubAllGlobals()
    })
  })

  describe('navigation', () => {
    it('teleport places the player outside the door', () => {
      useExplorerStore.setState({ reduceMotion: true })
      const d = DESTINATIONS.find((x) => x.id === 'CS-B')!
      teleportToDestination(d)
      expect(playerState.x).toBeCloseTo(d.stand.x)
      expect(playerState.z).toBeCloseTo(d.stand.z)
      expect(playerState.z).toBeGreaterThan(d.z)
    })
    it('routes through the door when the target is inside a building', () => {
      const path = planPath({ x: 0, z: 9 }, { x: -28, z: -22 })
      expect(path.length).toBeGreaterThan(2)
      expect(path[path.length - 1]).toEqual({ x: -28, z: -22 })
    })
  })
})