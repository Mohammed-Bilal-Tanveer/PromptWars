import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '@/components/ui'

/** Accessible tablist: roving tabindex, Arrow/Home/End navigation, aria-controls wiring to {@link TabPanel}. */
export function TabList<K extends string>({
  label, tabs, value, onChange, idPrefix, className,
}: {
  label: string
  tabs: readonly (readonly [K, string])[]
  value: K
  onChange: (k: K) => void
  idPrefix: string
  className?: string
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex(([k]) => k === value)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next < 0) return
    e.preventDefault()
    onChange(tabs[next][0])
    document.getElementById(`${idPrefix}-tab-${tabs[next][0]}`)?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className={className} onKeyDown={onKeyDown}>
      {tabs.map(([k, l]) => (
        <button
          key={k}
          id={`${idPrefix}-tab-${k}`}
          type="button"
          role="tab"
          aria-selected={value === k}
          aria-controls={`${idPrefix}-panel-${k}`}
          tabIndex={value === k ? 0 : -1}
          onClick={() => onChange(k)}
          className={cx('min-h-10 rounded-md px-3 text-sm font-medium transition-colors max-sm:min-h-11', value === k ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg')}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

export function TabPanel({ idPrefix, tab, children }: { idPrefix: string; tab: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${tab}`} aria-labelledby={`${idPrefix}-tab-${tab}`}>
      {children}
    </div>
  )
}

/** Stable per-instance id prefix for tab/panel wiring. */
export function useTabIds(name: string) {
  return `${name}-${useId().replace(/:/g, '')}`
}
