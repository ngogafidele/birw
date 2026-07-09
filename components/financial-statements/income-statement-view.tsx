"use client"

// Income statement view: date-range presets, custom range, and the computed statement.
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format"

type IncomeStatement = {
  revenue: number
  costOfGoodsSold: number
  grossProfit: number
  operatingExpenses: number
  netProfit: number
}

type StatementData = { statement: IncomeStatement; range: { from: string; to: string } }

type StatementResponse = {
  success: boolean
  data?: StatementData
  error?: string
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

// Presets use UTC to match the app's business time zone.
function ymd(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}`
}

type PresetKey = "this-month" | "last-month" | "this-year"

function presetRange(key: PresetKey): { start: string; end: string } {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const today = ymd(now)

  if (key === "this-month") {
    return { start: ymd(new Date(Date.UTC(year, month, 1))), end: today }
  }
  if (key === "last-month") {
    const start = new Date(Date.UTC(year, month - 1, 1))
    const end = new Date(Date.UTC(year, month, 0))
    return { start: ymd(start), end: ymd(end) }
  }
  return { start: ymd(new Date(Date.UTC(year, 0, 1))), end: today }
}

const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: "this-month", label: "This Month" },
  { key: "last-month", label: "Last Month" },
  { key: "this-year", label: "This Year" },
]

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load income statement"
}

export function IncomeStatementView() {
  const [initialRange] = useState(() => presetRange("this-month"))
  const [start, setStart] = useState(initialRange.start)
  const [end, setEnd] = useState(initialRange.end)
  const [statement, setStatement] = useState<IncomeStatement | null>(null)
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pure fetch — never touches state, so it is safe to call from an effect.
  const fetchStatement = useCallback(
    async (startInput: string, endInput: string): Promise<StatementData> => {
      const params = new URLSearchParams({ start: startInput, end: endInput })
      const response = await fetch(
        `/api/financial-statements/income-statement?${params.toString()}`
      )
      const payload = (await response.json()) as StatementResponse
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? "Failed to load income statement")
      }
      return payload.data
    },
    []
  )

  // Triggered by user actions (buttons), where synchronous setState is fine.
  const load = useCallback(
    async (startInput: string, endInput: string) => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchStatement(startInput, endInput)
        setStatement(data.statement)
        setRange(data.range)
      } catch (loadError) {
        setStatement(null)
        setRange(null)
        setError(errorMessage(loadError))
      } finally {
        setLoading(false)
      }
    },
    [fetchStatement]
  )

  // Initial load: state is only set after the await, never synchronously in the effect.
  useEffect(() => {
    let active = true
    fetchStatement(initialRange.start, initialRange.end)
      .then((data) => {
        if (!active) return
        setStatement(data.statement)
        setRange(data.range)
        setError(null)
      })
      .catch((loadError) => {
        if (!active) return
        setStatement(null)
        setRange(null)
        setError(errorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchStatement, initialRange])

  const applyPreset = (key: PresetKey) => {
    const next = presetRange(key)
    setStart(next.start)
    setEnd(next.end)
    load(next.start, next.end)
  }

  const downloadPdf = () => {
    const params = new URLSearchParams({
      start: range?.from ?? start,
      end: range?.to ?? end,
    })
    window.open(
      `/api/financial-statements/income-statement/pdf?${params.toString()}`,
      "_blank"
    )
  }

  const rows: Array<{
    label: string
    value: number
    kind: "line" | "subtotal" | "total"
  }> = statement
    ? [
        { label: "Revenue", value: statement.revenue, kind: "line" },
        {
          label: "Cost of Goods Sold",
          value: -statement.costOfGoodsSold,
          kind: "line",
        },
        { label: "Gross Profit", value: statement.grossProfit, kind: "subtotal" },
        {
          label: "Operating Expenses",
          value: -statement.operatingExpenses,
          kind: "line",
        },
        { label: "Net Profit", value: statement.netProfit, kind: "total" },
      ]
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.key}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset.key)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <label className="grid gap-1 text-sm">
          From
          <Input
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          To
          <Input
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <Button type="button" onClick={() => load(start, end)} disabled={loading}>
          {loading ? "Loading…" : "Produce"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={downloadPdf}
          disabled={loading || !statement}
        >
          Download PDF
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Income Statement</h3>
          {range ? (
            <p className="text-sm text-muted-foreground">
              {range.from} to {range.to}
            </p>
          ) : null}
        </div>

        {loading && !statement ? (
          <p className="text-sm text-muted-foreground">Calculating…</p>
        ) : statement ? (
          <dl className="divide-y divide-border/70">
            {rows.map((row) => (
              <div
                key={row.label}
                className={cn(
                  "flex items-center justify-between py-3",
                  row.kind === "subtotal" && "font-medium",
                  row.kind === "total" &&
                    "mt-1 border-t-2 border-border text-base font-semibold"
                )}
              >
                <dt className={cn(row.kind === "line" && "text-muted-foreground")}>
                  {row.label}
                </dt>
                <dd
                  className={cn(
                    row.kind === "total" &&
                      (row.value >= 0 ? "text-emerald-700" : "text-rose-700")
                  )}
                >
                  {formatCurrency(row.value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No data for the selected range.
          </p>
        )}
      </section>
    </div>
  )
}
