import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, Select, SkeletonCards,
} from '@/components/ui'
import { useDepartments, useEquipmentCategories, useEquipmentList, useLaboratories } from '@/hooks/useApi'
import { campusDate, localISO } from '@/lib/format'
import { ROUTES } from '@/lib/routes'
import type { EquipmentQuery, EquipmentStatus } from '@/types/api'
import { EquipmentCard } from './EquipmentCard'
import { EquipmentDetailPanel } from './EquipmentDetail'

export { availabilityStatus } from './EquipmentCard'
export { EquipmentDetailPanel }

const PAGE_SIZE = 12

export function EquipmentCatalogue() {
  const [params] = useSearchParams()
  const initialQ = params.get('q') ?? ''
  const [qInput, setQInput] = useState(initialQ)
  const [q, setQ] = useState(initialQ)
  const [department, setDepartment] = useState('')
  const [laboratory, setLaboratory] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<EquipmentStatus | ''>('')
  const [date, setDate] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<NonNullable<EquipmentQuery['sort']>>('relevance')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [qInput])

  const depts = useDepartments()
  const labs = useLaboratories({ department_id: department || undefined })
  const cats = useEquipmentCategories()

  const windowOk = !!(date && from && to)
  const query: EquipmentQuery = useMemo(
    () => ({
      q: q || undefined,
      department_id: department || undefined,
      laboratory_id: laboratory || undefined,
      category: category || undefined,
      status: status || undefined,
      available_from: windowOk ? localISO(date, from) : undefined,
      available_to: windowOk ? localISO(date, to) : undefined,
      sort,
      page,
      page_size: PAGE_SIZE,
    }),
    [q, department, laboratory, category, status, windowOk, date, from, to, sort, page],
  )
  const list = useEquipmentList(query)
  const windowInvalid = windowOk && to <= from
  const reset = () => {
    setQInput(''); setQ(''); setDepartment(''); setLaboratory(''); setCategory(''); setStatus('')
    setDate(''); setFrom(''); setTo(''); setSort('relevance'); setPage(1)
  }
  const upd = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.page_size)) : 1

  return (
    <div className="space-y-5">
      <PageHeader title="Equipment catalogue" subtitle="Search and filter specialised equipment across all labs. Sample campus data." />
      <Card as="section" aria-label="Filters">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search" htmlFor="eq-q" className="sm:col-span-2">
            <Input id="eq-q" type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Name, capability, lab…" />
          </Field>
          <Field label="Department" htmlFor="eq-dept">
            <Select id="eq-dept" value={department} onChange={(e) => { setDepartment(e.target.value); setLaboratory(''); setPage(1) }}>
              <option value="">All departments</option>
              {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Laboratory" htmlFor="eq-lab">
            <Select id="eq-lab" value={laboratory} onChange={(e) => upd(setLaboratory)(e.target.value)}>
              <option value="">All laboratories</option>
              {labs.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
          <Field label="Category" htmlFor="eq-cat">
            <Select id="eq-cat" value={category} onChange={(e) => upd(setCategory)(e.target.value)}>
              <option value="">All categories</option>
              {cats.data?.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Status" htmlFor="eq-status">
            <Select id="eq-status" value={status} onChange={(e) => upd(setStatus)(e.target.value as EquipmentStatus | '')}>
              <option value="">Any status</option>
              <option value="available">Available</option>
              <option value="occupied">Fully booked now</option>
              <option value="maintenance">Under maintenance</option>
            </Select>
          </Field>
          <Field label="Sort by" htmlFor="eq-sort">
            <Select id="eq-sort" value={sort} onChange={(e) => upd(setSort)(e.target.value as NonNullable<EquipmentQuery['sort']>)}>
              <option value="relevance">Relevance</option>
              <option value="availability">Availability</option>
              <option value="name">Name</option>
              <option value="utilisation">Utilisation</option>
            </Select>
          </Field>
          <Field label="Free on date" htmlFor="eq-date">
            <Input id="eq-date" type="date" value={date} min={campusDate()} onChange={(e) => upd(setDate)(e.target.value)} />
          </Field>
          <Field label="From" htmlFor="eq-from">
            <Input id="eq-from" type="time" value={from} onChange={(e) => upd(setFrom)(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="eq-to" error={windowInvalid ? 'End time must be after start time.' : null}>
            <Input id="eq-to" type="time" value={to} onChange={(e) => upd(setTo)(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button variant="secondary" onClick={reset} className="w-full sm:w-auto">Clear filters</Button>
          </div>
        </div>
      </Card>

      <div aria-live="polite">
        {list.isLoading ? (
          <div role="status" aria-busy="true"><span className="sr-only">Searching equipment…</span><SkeletonCards count={6} /></div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.data && list.data.items.length === 0 ? (
          <EmptyState title="No equipment matches your filters" hint="Try a broader search or clear the filters, or ask the Assistant to find a match." action={<div className="flex flex-wrap justify-center gap-2"><Button variant="secondary" onClick={reset}>Clear filters</Button><Link to={ROUTES.assistant} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-brand hover:underline">Ask the Assistant</Link></div>} />
        ) : (
          list.data && (
            <>
              <p className="mb-3 text-sm text-muted"><span className="tnum font-medium text-fg">{list.data.total}</span> result{list.data.total === 1 ? '' : 's'}</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.data.items.map((e) => <EquipmentCard key={e.id} e={e} />)}
              </div>
              <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <span className="tnum text-sm text-muted">Page {page} of {totalPages}</span>
                <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </nav>
            </>
          )
        )}
      </div>
    </div>
  )
}

export function EquipmentDetailPage() {
  const { id } = useParams()
  if (!id) return <EmptyState title="No equipment selected" />
  return <EquipmentDetailPanel equipmentId={id} />
}
