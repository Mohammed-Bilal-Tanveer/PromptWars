import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/services/apiClient'
import { usePublicConfig } from '@/hooks/useApi'
import { setCampusTimezone } from '@/lib/format'
import { Toasts } from '@/components/feedback/Toasts'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      // Retry network failures (Render cold start) but never 4xx.
      retry: (count, err) => (err instanceof ApiError && err.status >= 400 && err.status < 500 ? false : count < 3),
      retryDelay: (n) => Math.min(1000 * 2 ** n, 6000),
    },
  },
})

function ConfigBootstrap({ children }: { children: ReactNode }) {
  const { data } = usePublicConfig()
  useEffect(() => {
    if (data?.campus_timezone) setCampusTimezone(data.campus_timezone)
  }, [data])
  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigBootstrap>
        {children}
        <Toasts />
      </ConfigBootstrap>
    </QueryClientProvider>
  )
}
