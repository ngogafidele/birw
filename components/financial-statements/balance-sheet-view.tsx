"use client"

// Balance sheet view: an "as of" date, reconstructed auto lines, manual item CRUD,
// balance check, and an optional comparison date rendered as a muted second column.
import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format"

type BalanceSheetCategory =
  | "current_asset"
  | "fixed_asset"
  | "current_liability"
  | "long_term_liability"
  | "equity"

type BalanceSheetLine = {
  label: string
  amount: number
  source: "auto" | "manual"
  id?: string
  note?: string
}

type BalanceSheet = {
  asOf: string
  assets: { current: BalanceSheetLine[]; fixed: BalanceSheetLine[]; total: number }
  liabilities: {
    current: BalanceSheetLine[]
    longTerm: BalanceSheetLine[]
    total: number
  }
  equity: { lines: BalanceSheetLine[]; total: number }
  totalAssets: number
  totalLiabilitiesAndEquity: number
  balanceDifference: number
  inventoryWarnings?: string[]
}

type ManualItem = {
  groupId: string
  category: BalanceSheetCategory
  name: string
  amount: number
  effectiveDate: string
  notes: string
}

type SheetResponse = { success: boolean; data?: BalanceSheet; error?: string }
type ItemsResponse = { success: boolean; data?: ManualItem[]; error?: string }

const CATEGORY_GROUPS: Array<{
  group: string
  options: Array<{ value: BalanceSheetCategory; label: string }>
}> = [
  {
    group: "Assets",
    options: [
      { value: "current_asset", label: "Current Asset" },
      { value: "fixed_asset", label: "Fixed Asset" },
    ],
  },
  {
    group: "Liabilities",
    options: [
      { value: "current_liability", label: "Current Liability" },
      { value: "long_term_liability", label: "Long-term Liability" },
    ],
  },
  {
    group: "Equity",
    options: [{ value: "equity", label: "Equity" }],
  },
]

type FormState = {
  category: BalanceSheetCategory
  name: string
  amount: string
  effectiveDate: string
  notes: string
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function todayInput() {
  const now = new Date()
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(
    now.getUTCDate()
  )}`
}

function emptyForm(): FormState {
  return {
    category: "current_asset",
    name: "",
    amount: "",
    effectiveDate: todayInput(),
    notes: "",
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

// Maps a comparison sheet's lines to amounts keyed by manual-item id or auto-line label.
function buildCompareMap(lines: BalanceSheetLine[]) {
  return new Map(lines.map((line) => [line.id ?? line.label, line.amount]))
}

// Row model for a bordered balance-sheet table. Band rows introduce a sub-group,
// line rows carry a reconstructed/manual line, and subtotal/grand rows close a section.
type StatementRow =
  | { kind: "band"; label: string }
  | { kind: "empty" }
  | { kind: "line"; line: BalanceSheetLine; compareValue?: number | null }
  | {
      kind: "subtotal" | "grand"
      label: string
      amount: number
      compareAmount?: number
    }

// Builds the line rows for one sub-group, attaching the comparison amount (or null
// when the line has no counterpart) when comparison is active; undefined = off.
function lineRowsModel(
  lines: BalanceSheetLine[],
  compareMap?: Map<string, number> | null
): StatementRow[] {
  if (lines.length === 0) return [{ kind: "empty" }]
  return lines.map((line) => ({
    kind: "line",
    line,
    compareValue: compareMap
      ? compareMap.get(line.id ?? line.label) ?? null
      : undefined,
  }))
}

function BandRow({ label, span }: { label: string; span: number }) {
  return (
    <tr>
      <td
        colSpan={span}
        className="border border-border bg-muted px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
      </td>
    </tr>
  )
}

function EmptyRow({ span }: { span: number }) {
  return (
    <tr>
      <td
        colSpan={span}
        className="border border-border px-3 py-2 text-sm text-muted-foreground"
      >
        None recorded.
      </td>
    </tr>
  )
}

function DataRow({
  line,
  compare,
  compareValue,
  striped,
  onEdit,
  onDelete,
}: {
  line: BalanceSheetLine
  compare: boolean
  compareValue?: number | null
  striped: boolean
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <tr className={cn(striped && "bg-muted/30")}>
      <td className="border border-border px-3 py-2 align-top text-sm">
        {line.label}
        {line.note ? (
          <span className="block text-xs text-muted-foreground">{line.note}</span>
        ) : null}
      </td>
      {compare ? (
        <td className="border border-border px-3 py-2 text-right align-top text-sm tabular-nums text-muted-foreground">
          {typeof compareValue === "number" ? formatCurrency(compareValue) : "—"}
        </td>
      ) : null}
      <td className="border border-border px-3 py-2 text-right align-top text-sm tabular-nums">
        <span className="flex items-center justify-end gap-2">
          {formatCurrency(line.amount)}
          {line.source === "manual" && line.id ? (
            <span className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onEdit(line.id as string)}
                aria-label={`Edit ${line.label}`}
              >
                <Pencil />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onDelete(line.id as string)}
                aria-label={`Delete ${line.label}`}
              >
                <Trash2 />
              </Button>
            </span>
          ) : null}
        </span>
      </td>
    </tr>
  )
}

function TotalRow({
  label,
  amount,
  compare,
  compareAmount,
  emphasis,
}: {
  label: string
  amount: number
  compare: boolean
  compareAmount?: number
  emphasis: "subtotal" | "grand"
}) {
  const hasCompare = typeof compareAmount === "number"
  const delta = hasCompare ? amount - compareAmount : 0
  return (
    <tr
      className={cn(
        emphasis === "grand"
          ? "border-t-2 border-t-accent bg-muted/60 font-semibold"
          : "bg-muted/50 font-medium"
      )}
    >
      <td className="border border-border px-3 py-2">{label}</td>
      {compare ? (
        <td className="border border-border px-3 py-2 text-right font-normal tabular-nums text-muted-foreground">
          {hasCompare ? formatCurrency(compareAmount) : "—"}
        </td>
      ) : null}
      <td className="border border-border px-3 py-2 text-right tabular-nums">
        <span className="flex items-center justify-end gap-2">
          {formatCurrency(amount)}
          {hasCompare ? (
            <span
              className={cn(
                "text-xs font-normal",
                delta >= 0 ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {delta >= 0 ? "+" : ""}
              {formatCurrency(delta)}
            </span>
          ) : null}
        </span>
      </td>
    </tr>
  )
}

// Renders one side of the balance sheet as a bordered grid. A running counter
// stripes only data rows so band/total rows never break the zebra rhythm.
function SideTable({
  title,
  rows,
  compare,
  currentLabel,
  compareLabel,
  onEdit,
  onDelete,
}: {
  title: string
  rows: StatementRow[]
  compare: boolean
  currentLabel: string
  compareLabel: string
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const span = compare ? 3 : 2
  return (
    <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-border text-sm">
          <thead>
            <tr className="bg-muted text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <th className="border border-border px-3 py-2 text-left font-medium">
                Description
              </th>
              {compare ? (
                <th className="border border-border px-3 py-2 text-right font-medium">
                  {compareLabel}
                </th>
              ) : null}
              <th className="border border-border px-3 py-2 text-right font-medium">
                {currentLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              if (row.kind === "band") {
                return <BandRow key={`band-${index}`} label={row.label} span={span} />
              }
              if (row.kind === "empty") {
                return <EmptyRow key={`empty-${index}`} span={span} />
              }
              if (row.kind === "line") {
                // Stripe by ordinal among data rows only, so band/total rows
                // never break the zebra rhythm (no mutable render counter).
                const striped =
                  rows.slice(0, index).filter((r) => r.kind === "line").length %
                    2 ===
                  1
                return (
                  <DataRow
                    key={row.line.id ?? `${row.line.label}-${index}`}
                    line={row.line}
                    compare={compare}
                    compareValue={row.compareValue}
                    striped={striped}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                )
              }
              return (
                <TotalRow
                  key={`total-${index}`}
                  label={row.label}
                  amount={row.amount}
                  compare={compare}
                  compareAmount={row.compareAmount}
                  emphasis={row.kind}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function BalanceSheetView() {
  const [initialAsOf] = useState(todayInput)
  const [asOf, setAsOf] = useState(initialAsOf)
  const [compareAsOf, setCompareAsOf] = useState("")
  const [sheet, setSheet] = useState<BalanceSheet | null>(null)
  const [compareSheet, setCompareSheet] = useState<BalanceSheet | null>(null)
  const [items, setItems] = useState<ManualItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Pure fetches — no state, safe to call from an effect.
  const fetchSheet = useCallback(async (asOfInput: string): Promise<BalanceSheet> => {
    const params = new URLSearchParams({ asOf: asOfInput })
    const response = await fetch(
      `/api/financial-statements/balance-sheet?${params.toString()}`
    )
    const payload = (await response.json()) as SheetResponse
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Failed to load balance sheet")
    }
    return payload.data
  }, [])

  const fetchItems = useCallback(async (asOfInput: string): Promise<ManualItem[]> => {
    const params = new URLSearchParams({ asOf: asOfInput })
    const response = await fetch(
      `/api/financial-statements/balance-sheet/items?${params.toString()}`
    )
    const payload = (await response.json()) as ItemsResponse
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? "Failed to load items")
    }
    return payload.data
  }, [])

  const load = useCallback(
    async (asOfInput: string, compareInput?: string) => {
      setLoading(true)
      setError(null)
      try {
        const [nextSheet, nextItems, nextCompare] = await Promise.all([
          fetchSheet(asOfInput),
          fetchItems(asOfInput),
          compareInput ? fetchSheet(compareInput) : Promise.resolve(null),
        ])
        setSheet(nextSheet)
        setItems(nextItems)
        setCompareSheet(nextCompare)
      } catch (loadError) {
        setSheet(null)
        setCompareSheet(null)
        setItems([])
        setError(errorMessage(loadError, "Failed to load balance sheet"))
      } finally {
        setLoading(false)
      }
    },
    [fetchSheet, fetchItems]
  )

  // Initial load: state is only set after the awaits, never synchronously in the effect.
  useEffect(() => {
    let active = true
    Promise.all([fetchSheet(initialAsOf), fetchItems(initialAsOf)])
      .then(([nextSheet, nextItems]) => {
        if (!active) return
        setSheet(nextSheet)
        setItems(nextItems)
        setError(null)
      })
      .catch((loadError) => {
        if (!active) return
        setSheet(null)
        setItems([])
        setError(errorMessage(loadError, "Failed to load balance sheet"))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [fetchSheet, fetchItems, initialAsOf])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (groupId: string) => {
    const item = items.find((entry) => entry.groupId === groupId)
    if (!item) return
    setEditingId(groupId)
    setForm({
      category: item.category,
      name: item.name,
      amount: String(item.amount),
      effectiveDate: item.effectiveDate || todayInput(),
      notes: item.notes,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const submitForm = async () => {
    const amount = Number(form.amount)
    if (!form.name.trim()) {
      setFormError("Name is required")
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError("Amount must be zero or greater")
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      const body = {
        category: form.category,
        name: form.name.trim(),
        amount,
        effectiveDate: form.effectiveDate,
        notes: form.notes.trim() || undefined,
      }
      const response = await fetch(
        editingId
          ? `/api/financial-statements/balance-sheet/items/${editingId}`
          : "/api/financial-statements/balance-sheet/items",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
      const payload = (await response.json()) as { success: boolean; error?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to save item")
      }
      setDialogOpen(false)
      await load(asOf, compareAsOf || undefined)
    } catch (saveError) {
      setFormError(errorMessage(saveError, "Failed to save item"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (groupId: string) => {
    const item = items.find((entry) => entry.groupId === groupId)
    const label = item ? item.name : "this item"
    if (!window.confirm(`Remove ${label} from the balance sheet?`)) return
    try {
      const response = await fetch(
        `/api/financial-statements/balance-sheet/items/${groupId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ effectiveDate: asOf }),
        }
      )
      const payload = (await response.json()) as { success: boolean; error?: string }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to delete item")
      }
      await load(asOf, compareAsOf || undefined)
    } catch (deleteError) {
      setError(errorMessage(deleteError, "Failed to delete item"))
    }
  }

  const downloadPdf = () => {
    const params = new URLSearchParams({ asOf: sheet?.asOf ?? asOf })
    window.open(
      `/api/financial-statements/balance-sheet/pdf?${params.toString()}`,
      "_blank"
    )
  }

  const balanced = sheet ? Math.round(sheet.balanceDifference) === 0 : false

  // Comparison amounts keyed by manual-item id or auto-line label. Plain derived
  // value: the React Compiler memoizes it, and a manual useMemo here trips the
  // preserve-manual-memoization rule.
  const compareMaps = compareSheet
    ? {
        assetsCurrent: buildCompareMap(compareSheet.assets.current),
        assetsFixed: buildCompareMap(compareSheet.assets.fixed),
        liabilitiesCurrent: buildCompareMap(compareSheet.liabilities.current),
        liabilitiesLongTerm: buildCompareMap(compareSheet.liabilities.longTerm),
        equity: buildCompareMap(compareSheet.equity.lines),
      }
    : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            As Of
            <Input
              type="date"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Compare To (optional)
            <Input
              type="date"
              value={compareAsOf}
              onChange={(event) => setCompareAsOf(event.target.value)}
            />
          </label>
          <Button
            type="button"
            onClick={() => load(asOf, compareAsOf || undefined)}
            disabled={loading}
          >
            {loading ? "Loading…" : "Produce"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={downloadPdf}
            disabled={loading || !sheet}
          >
            Download PDF
          </Button>
        </div>
        <Button type="button" variant="outline" onClick={openCreate}>
          <Plus className="size-4" />
          Add Item
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      {loading && !sheet ? (
        <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Calculating…</p>
        </section>
      ) : sheet ? (
        <>
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm",
              balanced
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-amber-200 bg-amber-50 text-amber-950"
            )}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.16em] opacity-70">
                Balance Check
              </p>
              <p className="text-sm">
                {balanced
                  ? "Assets equal Liabilities + Equity."
                  : "Assets do not equal Liabilities + Equity."}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.16em] opacity-70">
                Difference
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(sheet.balanceDifference)}
              </p>
            </div>
          </div>

          {sheet.inventoryWarnings && sheet.inventoryWarnings.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-medium">Inventory history warning</p>
              <p>
                Reconstructed stock went negative for:{" "}
                {sheet.inventoryWarnings.join(", ")}. These products are excluded
                from the inventory value — review their receipts, sales, and
                adjustments for this period.
              </p>
            </div>
          ) : null}

          {compareSheet ? (
            <p className="text-xs text-muted-foreground">
              Muted figures show {compareSheet.asOf}; deltas are {sheet.asOf} minus{" "}
              {compareSheet.asOf}.
            </p>
          ) : null}

          {(() => {
            const compare = Boolean(compareSheet)
            const currentLabel = compare ? sheet.asOf : "Amount"
            const compareLabel = compareSheet?.asOf ?? ""

            const assetRows: StatementRow[] = [
              { kind: "band", label: "Current Assets" },
              ...lineRowsModel(sheet.assets.current, compareMaps?.assetsCurrent),
              { kind: "band", label: "Fixed Assets" },
              ...lineRowsModel(sheet.assets.fixed, compareMaps?.assetsFixed),
              {
                kind: "grand",
                label: "Total Assets",
                amount: sheet.assets.total,
                compareAmount: compareSheet?.assets.total,
              },
            ]

            const liabilityRows: StatementRow[] = [
              { kind: "band", label: "Current Liabilities" },
              ...lineRowsModel(
                sheet.liabilities.current,
                compareMaps?.liabilitiesCurrent
              ),
              { kind: "band", label: "Long-term Liabilities" },
              ...lineRowsModel(
                sheet.liabilities.longTerm,
                compareMaps?.liabilitiesLongTerm
              ),
              {
                kind: "subtotal",
                label: "Total Liabilities",
                amount: sheet.liabilities.total,
                compareAmount: compareSheet?.liabilities.total,
              },
              { kind: "band", label: "Equity" },
              ...lineRowsModel(sheet.equity.lines, compareMaps?.equity),
              {
                kind: "subtotal",
                label: "Total Equity",
                amount: sheet.equity.total,
                compareAmount: compareSheet?.equity.total,
              },
              {
                kind: "grand",
                label: "Total Liabilities + Equity",
                amount: sheet.totalLiabilitiesAndEquity,
                compareAmount: compareSheet?.totalLiabilitiesAndEquity,
              },
            ]

            return (
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <SideTable
                  title="Assets"
                  rows={assetRows}
                  compare={compare}
                  currentLabel={currentLabel}
                  compareLabel={compareLabel}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
                <SideTable
                  title="Liabilities & Equity"
                  rows={liabilityRows}
                  compare={compare}
                  currentLabel={currentLabel}
                  compareLabel={compareLabel}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              </div>
            )
          })()}
        </>
      ) : (
        <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            No data for the selected date.
          </p>
        </section>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit item" : "Add item"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Category
              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    category: value as BalanceSheetCategory,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_GROUPS.map((group) => (
                    <SelectGroup key={group.group}>
                      <SelectLabel>{group.group}</SelectLabel>
                      {group.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1 text-sm">
              Name
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. Cash & Bank, Bank Loan - BPR"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Amount
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, amount: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                Effective Date
                <Input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      effectiveDate: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              Notes (optional)
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                className="min-h-20 rounded-md border border-border px-3 py-2"
              />
            </label>
            {editingId ? (
              <p className="text-xs text-muted-foreground">
                Saving records a new dated version; balance sheets before the
                effective date are unchanged.
              </p>
            ) : null}
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submitForm} disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
