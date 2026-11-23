import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog, Field, Input, Modal } from './index'

/** Parent re-renders on every keystroke and passes an inline onClose, like real callers do. */
function Host() {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [text, setText] = useState('')
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Outer">
        <input aria-label="Name" value={text} onChange={(e) => setText(e.target.value)} />
        <button onClick={() => setConfirm(true)}>Ask</button>
        <ConfirmDialog open={confirm} title="Sure?" message="Really?" onCancel={() => setConfirm(false)} onConfirm={() => setConfirm(false)} />
      </Modal>
    </div>
  )
}

describe('Modal', () => {
  it('does not steal focus when the parent re-renders', async () => {
    const u = userEvent.setup()
    render(<Host />)
    await u.click(screen.getByText('Open'))
    const input = screen.getByLabelText('Name')
    await u.click(input)
    await u.keyboard('abc')
    expect(input).toHaveValue('abc')
    expect(input).toHaveFocus()
  })

  it('Esc closes only the topmost modal and focus returns to the trigger', async () => {
    const u = userEvent.setup()
    render(<Host />)
    await u.click(screen.getByText('Open'))
    await u.click(screen.getByText('Ask'))
    expect(screen.getByRole('dialog', { name: 'Sure?' })).toBeInTheDocument()
    await u.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Sure?' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Outer' })).toBeInTheDocument()
    await u.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Open')).toHaveFocus()
  })

  it('traps Tab / Shift+Tab inside the dialog and locks body scroll', async () => {
    const u = userEvent.setup()
    const { unmount } = render(<Modal open onClose={() => {}} title="Trap"><button>First</button><button>Last</button></Modal>)
    expect(document.body.style.overflow).toBe('hidden')
    const close = screen.getByRole('button', { name: 'Close dialog' })
    close.focus()
    await u.tab({ shift: true })
    expect(screen.getByText('Last')).toHaveFocus()
    await u.tab()
    expect(close).toHaveFocus()
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('calls the latest onClose', async () => {
    const u = userEvent.setup()
    const a = vi.fn(), b = vi.fn()
    const { rerender } = render(<Modal open onClose={a} title="T">x</Modal>)
    rerender(<Modal open onClose={b} title="T">x</Modal>)
    await u.keyboard('{Escape}')
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
  })
})

describe('Field', () => {
  it('links the error to the control via aria-invalid and aria-describedby', () => {
    render(<Field label="Title" htmlFor="t" error="Required"><Input id="t" /></Field>)
    const input = screen.getByLabelText('Title')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const id = input.getAttribute('aria-describedby')!
    expect(document.getElementById(id)).toHaveTextContent('Required')
  })

  it('links the hint when there is no error and merges existing describedby', () => {
    render(<Field label="Unit" htmlFor="u" hint="Pick one"><Input id="u" aria-describedby="extra" /></Field>)
    const input = screen.getByLabelText('Unit')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input.getAttribute('aria-describedby')).toBe('extra u-hint')
    expect(document.getElementById('u-hint')).toHaveTextContent('Pick one')
  })
})
