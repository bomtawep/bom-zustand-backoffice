"use client";

import { useState, type ReactNode } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/lib/query-helpers";
import { useSessionStore } from "@/stores/session-store";

function redirectToLogin() {
  useSessionStore.getState().clear();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

function handleQueryAuthError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    redirectToLogin();
  }
}

function handleMutationAuthError(
  error: unknown,
  _variables: unknown,
  _onMutateResult: unknown,
  mutation: { meta?: { skipAuthRedirect?: boolean } }
) {
  // Some endpoints (e.g. change-password) legitimately respond 401 for a business-logic
  // reason (wrong current password) rather than an expired/invalid session. Those mutations
  // opt out via `meta: { skipAuthRedirect: true }` so they can show their own error instead
  // of being hijacked into a forced logout/redirect.
  if (mutation.meta?.skipAuthRedirect) return;
  if (error instanceof ApiError && error.status === 401) {
    redirectToLogin();
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
        queryCache: new QueryCache({ onError: handleQueryAuthError }),
        mutationCache: new MutationCache({ onError: handleMutationAuthError }),
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
