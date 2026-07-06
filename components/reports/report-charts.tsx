"use client"

// Recharts visualizations for the admin reports page.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatCurrency } from "@/lib/utils/format"
import { formatInBusinessTime } from "@/lib/utils/time"

const REVENUE_COLOR = "var(--chart-1)"
const PROFIT_COLOR = "var(--chart-3)"
const PAID_COLOR = "var(--chart-1)"
const LOAN_COLOR = "var(--chart-2)"

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" }

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
}

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

function formatAxisAmount(value: number) {
  return compactNumber.format(value)
}

function formatAxisDate(value: string, granularity: "day" | "month") {
  return formatInBusinessTime(
    value,
    granularity === "month"
      ? { month: "short", year: "2-digit" }
      : { month: "short", day: "2-digit" }
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

export type TrendPoint = {
  date: string
  revenue: number
  profit: number
}

export function RevenueProfitTrendChart({
  data,
  granularity,
}: {
  data: TrendPoint[]
  granularity: "day" | "month"
}) {
  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={24}
            tickFormatter={(value: string) => formatAxisDate(value, granularity)}
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={formatAxisAmount}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(value: string) =>
              formatInBusinessTime(
                value,
                granularity === "month"
                  ? { month: "long", year: "numeric" }
                  : { year: "numeric", month: "short", day: "2-digit" }
              )
            }
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            name="Net revenue"
            stroke={REVENUE_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="profit"
            name="Profit"
            stroke={PROFIT_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <LegendDot color={REVENUE_COLOR} label="Net revenue" />
        <LegendDot color={PROFIT_COLOR} label="Profit" />
      </div>
    </div>
  )
}

export type TopProductPoint = {
  sku: string
  name: string
  revenue: number
}

export function TopProductsChart({ data }: { data: TopProductPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tickFormatter={formatAxisAmount}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={120}
          tickFormatter={(value: string) =>
            value.length > 16 ? `${value.slice(0, 15)}…` : value
          }
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={tooltipStyle}
          formatter={(value: number) => [formatCurrency(value), "Net revenue"]}
        />
        <Bar dataKey="revenue" fill={REVENUE_COLOR} radius={[0, 6, 6, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export type PaymentMixPoint = {
  label: string
  amount: number
  kind: "paid" | "loan"
}

export function PaymentMixChart({ data }: { data: PaymentMixPoint[] }) {
  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 20, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={0}
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={formatAxisAmount}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={tooltipStyle}
            formatter={(value: number, _name, item) => [
              formatCurrency(value),
              item?.payload?.kind === "loan" ? "Loan sales" : "Paid sales",
            ]}
          />
          <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={64}>
            <LabelList
              dataKey="amount"
              position="top"
              formatter={(value: number) => formatAxisAmount(value)}
              style={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            {data.map((entry) => (
              <Cell
                key={entry.label}
                fill={entry.kind === "loan" ? LOAN_COLOR : PAID_COLOR}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <LegendDot color={PAID_COLOR} label="Paid sales" />
        <LegendDot color={LOAN_COLOR} label="Loans (unpaid)" />
      </div>
    </div>
  )
}
