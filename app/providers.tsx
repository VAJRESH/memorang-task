"use client";

import type { ReactNode } from "react";
import { CopilotKit } from "@copilotkit/react-core";

/**
 * Client-side provider boundary for the application.
 *
 * `CopilotKit` is a React context provider and must run on the client, so it
 * is isolated here behind a `"use client"` directive. This keeps the root
 * layout (`app/layout.tsx`) a server component while still wrapping every
 * route in the CopilotKit runtime context pointed at `/api/copilotkit`.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <CopilotKit runtimeUrl="/api/copilotkit">{children}</CopilotKit>;
}
