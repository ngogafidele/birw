// Shared date-range and as-of resolution for financial statements.
import {
  formatBusinessDateInput,
  getBusinessDateParts,
  parseBusinessDateInput,
} from "@/lib/utils/time"

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function todayBusinessDate() {
  const now = new Date()
  const parts = getBusinessDateParts(now)
  const input = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day
  ).padStart(2, "0")}`
  return parseBusinessDateInput(input) ?? now
}

export type ResolvedRange = {
  from: Date
  to: Date
  endExclusive: Date
  fromInput: string
  toInput: string
}

// Parses start/end query params into an inclusive business-day range, defaulting to the
// current month through today. Mirrors the Reports page range semantics.
export function resolveIncomeRange(
  startParam: string | undefined,
  endParam: string | undefined
): ResolvedRange {
  const today = todayBusinessDate()
  const parts = getBusinessDateParts(today)
  const monthStartInput = `${parts.year}-${String(parts.month).padStart(2, "0")}-01`
  const monthStart = parseBusinessDateInput(monthStartInput) ?? today

  let from = parseBusinessDateInput(startParam) ?? monthStart
  let to = parseBusinessDateInput(endParam) ?? today

  if (from > to) {
    const earlier = to
    to = from
    from = earlier
  }

  return {
    from,
    to,
    endExclusive: addDays(to, 1),
    fromInput: formatBusinessDateInput(from),
    toInput: formatBusinessDateInput(to),
  }
}

export type ResolvedAsOf = {
  asOf: Date
  endExclusive: Date
  asOfInput: string
}

// Parses an as-of query param into an inclusive business day, defaulting to today.
export function resolveAsOf(asOfParam: string | undefined): ResolvedAsOf {
  const asOf = parseBusinessDateInput(asOfParam) ?? todayBusinessDate()
  return {
    asOf,
    endExclusive: addDays(asOf, 1),
    asOfInput: formatBusinessDateInput(asOf),
  }
}
