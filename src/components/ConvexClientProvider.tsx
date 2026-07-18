import { useState } from 'react'
import { ConvexProvider, ConvexReactClient } from 'convex/react'

import type { ReactNode } from 'react'

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() =>
    convexUrl ? new ConvexReactClient(convexUrl) : null,
  )

  if (!client) return <>{children}</>
  return <ConvexProvider client={client}>{children}</ConvexProvider>
}
