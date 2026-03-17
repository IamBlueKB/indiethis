"use client";

import { useState } from "react";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionSync } from "@/components/SessionSync";

export function Providers({ children }: { children: React.ReactNode }) {
  // Create a stable QueryClient instance per browser session.
  // Using useState ensures a new client isn't created on every render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 60 seconds — avoids redundant refetches
            // when navigating between pages that share the same query key.
            staleTime: 60_000,
            // Don't refetch when the user switches back to the tab (too noisy).
            refetchOnWindowFocus: false,
            // Retry failed requests once before surfacing the error.
            retry: 1,
          },
          mutations: {
            // Mutations don't retry automatically — let the UI handle errors.
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <SessionSync />
          {children}
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
