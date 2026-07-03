// Shared API error detection helpers and standard user-facing messages.

// Standard message shown when the database cannot be reached. Retrying is
// honest advice because connectToDatabase resets its cached connection on
// failure, so a later attempt can succeed once connectivity returns.
export const NETWORK_ERROR_MESSAGE =
  "Network problem. We cannot reach the database right now. Please try again."

// Detects MongoDB duplicate-key (E11000) violations.
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  )
}

// Detects database/network connectivity failures so routes can return a clear
// "cannot reach the database" message instead of a generic failure. Covers the
// common DNS, SRV, socket, and driver server-selection timeout strings.
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes("querysrv etimeout") ||
    message.includes("querysrv enotfound") ||
    message.includes("enotfound") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("getaddrinfo") ||
    message.includes("server selection timed out") ||
    message.includes("topology was destroyed") ||
    message.includes("network")
  )
}
