import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/services/apiClient'
import { usePublicConfig } from '@/hooks/useApi'
import { setCampusTimezone } from '@/lib/format'
import { Toasts } from '@/components/feedback/Toasts'
import { ConnectionManager } from '@/features/connection/ConnectionManager'
import { isGatewayStatus } from '@/features/connection/connectionStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      // Never retry 4xx. Network/gateway failures are handled by the connection monitor
      // (single-flight health polling, then a refetch), so queries must not hammer the API.
      retry: (count, err) => {
        if (err instanceof ApiError && ((err.status >= 400 && err.status < 500) || err.status === 0 || isGatewayStatus(err.status))) return false
        return count < 3
      },
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
        <ConnectionManager />
      </ConfigBootstrap>
    </QueryClientProvider>
  )
}
