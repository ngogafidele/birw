// Renders income statement and balance sheet PDFs using the shared BIRW print identity.
import { createRequire } from "module"
import path from "node:path"
import type * as Fs from "node:fs"
import { PDF_COLORS } from "@/lib/pdf/pdf-theme"
import { formatCurrency } from "@/lib/utils/format"

const require = createRequire(import.meta.url)
const {
  existsSync,
  readFileSync,
}: {
  existsSync: typeof Fs.existsSync
  readFileSync: typeof Fs.readFileSync
} = require("node:fs")
const PDFKitModule = require("pdfkit") as
  | typeof import("pdfkit").default
  | {
      default?: typeof import("pdfkit").default
      PDFDocument?: typeof import("pdfkit").default
    }
const PDFDocument =
  typeof PDFKitModule === "function"
    ? PDFKitModule
    : PDFKitModule.default ?? PDFKitModule.PDFDocument

type PdfDoc = {
  rect(x: number, y: number, width: number, height: number): PdfDoc
  fillColor(color: string): PdfDoc
  fill(): PdfDoc
  image(
    src: string | Buffer,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number; fit?: [number, number] }
  ): PdfDoc
  font(name: string): PdfDoc
  fontSize(size: number): PdfDoc
  text(
    text: string,
    x?: number,
    y?: number,
    options?: { align?: "left" | "right" | "center"; width?: number }
  ): PdfDoc
  lineTo(x: number, y: number): PdfDoc
  moveTo(x: number, y: number): PdfDoc
  lineWidth(width: number): PdfDoc
  strokeColor(color: string): PdfDoc
  stroke(): PdfDoc
  addPage(): PdfDoc
  heightOfString(text: string, options?: { width?: number }): number
  on(event: "data", listener: (chunk: Buffer) => void): PdfDoc
  on(event: "end", listener: () => void): PdfDoc
  on(event: "error", listener: (error: unknown) => void): PdfDoc
  end(): void
}

type StoreInfo = {
  name?: string
  address?: string
  tin?: string
  phone?: string
  email?: string
  bprBankAccounts?: string
  momo?: string
}

export type IncomeStatementPdfPayload = {
  range: { from: string; to: string }
  generatedAt?: Date | string
  statement: {
    revenue: number
    costOfGoodsSold: number
    grossProfit: number
    operatingExpenses: number
    netProfit: number
  }
}

type BalanceSheetLine = { label: string; amount: number; note?: string }

export type BalanceSheetPdfPayload = {
  asOf: string
  generatedAt?: Date | string
  sheet: {
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
  }
}

const LEFT = 48
const RIGHT = 547
const DIVIDER_X = 372
const CELL_PAD = 8
const ROW_HEIGHT = 22
const PAGE_BREAK_Y = 760
const THANK_YOU_LINE = "Thank you for doing business with us."

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")
const logoBox = {
  x: 42,
  y: 24,
  width: 120,
  height: 120,
  imageX: 48,
  imageY: 30,
  imageFit: [108, 108] as [number, number],
}

function formatDate(value: Date | string | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-RW", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value))
}

function getLogoBuffer() {
  if (!existsSync(logoPath)) return null
  return readFileSync(logoPath)
}

function drawLogo(doc: PdfDoc, storeInfo: StoreInfo) {
  doc.rect(logoBox.x, logoBox.y, logoBox.width, logoBox.height).fillColor(PDF_COLORS.surface).fill()

  const logoBuffer = getLogoBuffer()
  try {
    if (!logoBuffer) throw new Error("Logo not found")
    doc.image(logoBuffer, logoBox.imageX, logoBox.imageY, { fit: logoBox.imageFit })
  } catch {
    try {
      doc.image(logoPath, logoBox.imageX, logoBox.imageY, { fit: logoBox.imageFit })
    } catch {
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(PDF_COLORS.headerText)
        .text(storeInfo.name ?? "Inventory", 48, 72, { width: 150 })
    }
  }
}

// Draws logo, title/date on the right, the accent separator, and the store identity block.
// Returns the y coordinate where statement content should begin.
function drawHeader(
  doc: PdfDoc,
  storeInfo: StoreInfo,
  title: string,
  subtitle: string,
  generatedAt: Date | string | undefined
): number {
  drawLogo(doc, storeInfo)

  const titleX = 340
  const titleY = logoBox.y + 12
  doc.font("Helvetica-Bold").fontSize(22)
  const titleHeight = doc.heightOfString(title, { width: 200 })
  const subtitleY = titleY + titleHeight + 6
  doc
    .fillColor(PDF_COLORS.text)
    .text(title, titleX, titleY, { align: "right", width: RIGHT - titleX })
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(PDF_COLORS.mutedText)
    .text(subtitle, titleX, subtitleY, { align: "right", width: RIGHT - titleX })
    .text(`Date: ${formatDate(generatedAt)}`, titleX, subtitleY + 14, {
      align: "right",
      width: RIGHT - titleX,
    })

  const headerBottom = Math.max(logoBox.y + logoBox.height, subtitleY + 30)
  const separatorY = Math.ceil(headerBottom + 16)
  doc
    .moveTo(LEFT, separatorY)
    .lineTo(RIGHT, separatorY)
    .lineWidth(1.5)
    .strokeColor(PDF_COLORS.accent)
    .stroke()

  const contentStart = separatorY + 20
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(PDF_COLORS.text)
    .text(storeInfo.name ?? "BIRW INVESTMENT GROUP Ltd", LEFT, contentStart)
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(PDF_COLORS.mutedText)
    .text(storeInfo.tin ? `TIN: ${storeInfo.tin}` : "", LEFT, contentStart + 18)
    .text(storeInfo.phone ?? "", LEFT, contentStart + 32)
    .text(storeInfo.address ?? "", LEFT, contentStart + 46)
    .text(storeInfo.email ?? "", LEFT, contentStart + 60)

  return contentStart + 92
}

type Cursor = { y: number }

function ensureSpace(doc: PdfDoc, cursor: Cursor, needed = 22) {
  if (cursor.y + needed > PAGE_BREAK_Y) {
    doc.addPage()
    cursor.y = 56
  }
}

const LABEL_WIDTH = DIVIDER_X - LEFT - CELL_PAD * 2
const AMOUNT_WIDTH = RIGHT - DIVIDER_X - CELL_PAD

// PDFKit's built-in Helvetica uses WinAnsi encoding, which lacks the Unicode
// minus (U+2212) and en/em dashes — they render as stray glyphs. Map them to a
// plain hyphen so labels and manual-item notes stay legible in print.
function sanitizeText(value: string) {
  return value.replace(/[−–—]/g, "-")
}

// Strokes a row's outer box, the label/amount divider, and an optional heavier top rule.
function drawRowBorders(
  doc: PdfDoc,
  yTop: number,
  height: number,
  options: { withDivider?: boolean; heavyTop?: "border" | "accent" } = {}
) {
  doc.lineWidth(0.7).strokeColor(PDF_COLORS.border)
  doc.rect(LEFT, yTop, RIGHT - LEFT, height).stroke()
  if (options.withDivider ?? true) {
    doc.moveTo(DIVIDER_X, yTop).lineTo(DIVIDER_X, yTop + height).stroke()
  }
  if (options.heavyTop) {
    const accent = options.heavyTop === "accent"
    doc
      .lineWidth(accent ? 1.4 : 1)
      .strokeColor(accent ? PDF_COLORS.accent : PDF_COLORS.text)
      .moveTo(LEFT, yTop)
      .lineTo(RIGHT, yTop)
      .stroke()
  }
}

// Draws the DESCRIPTION / AMOUNT column header band in the shared print style.
function drawTableHeader(doc: PdfDoc, cursor: Cursor) {
  ensureSpace(doc, cursor, ROW_HEIGHT)
  const yTop = cursor.y
  doc.rect(LEFT, yTop, RIGHT - LEFT, ROW_HEIGHT).fillColor(PDF_COLORS.tableHeader).fill()
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(PDF_COLORS.sectionText)
    .text("DESCRIPTION", LEFT + CELL_PAD, yTop + 7, { width: LABEL_WIDTH })
    .text("AMOUNT", DIVIDER_X + CELL_PAD, yTop + 7, {
      width: AMOUNT_WIDTH - CELL_PAD,
      align: "right",
    })
  drawRowBorders(doc, yTop, ROW_HEIGHT)
  cursor.y = yTop + ROW_HEIGHT
}

// Draws a full-width grouping band (e.g. "CURRENT ASSETS") spanning both columns.
function drawBandRow(doc: PdfDoc, cursor: Cursor, text: string) {
  ensureSpace(doc, cursor, 20)
  const yTop = cursor.y
  const height = 20
  doc.rect(LEFT, yTop, RIGHT - LEFT, height).fillColor(PDF_COLORS.neutralFill).fill()
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(PDF_COLORS.mutedText)
    .text(text.toUpperCase(), LEFT + CELL_PAD, yTop + 6, { width: RIGHT - LEFT - CELL_PAD * 2 })
  drawRowBorders(doc, yTop, height, { withDivider: false })
  cursor.y = yTop + height
}

// Draws a single bordered table row: label in the left cell, amount right-aligned in the right cell.
function drawTableRow(
  doc: PdfDoc,
  cursor: Cursor,
  label: string,
  amount: number | null,
  options: {
    indent?: number
    bold?: boolean
    muted?: boolean
    accent?: boolean
    fill?: string
    heavyTop?: "border" | "accent"
    note?: string
  } = {}
) {
  const indent = options.indent ?? 0
  const labelWidth = LABEL_WIDTH - indent
  const noteFontSize = 8

  let height = ROW_HEIGHT
  if (options.note) {
    doc.font("Helvetica").fontSize(noteFontSize)
    height = 20 + doc.heightOfString(options.note, { width: labelWidth }) + 6
  }

  ensureSpace(doc, cursor, height)
  const yTop = cursor.y

  if (options.fill) {
    doc.rect(LEFT, yTop, RIGHT - LEFT, height).fillColor(options.fill).fill()
  }

  const textColor = options.muted ? PDF_COLORS.mutedText : PDF_COLORS.text
  doc
    .font(options.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(options.bold ? 11 : 10)
    .fillColor(textColor)
    .text(sanitizeText(label), LEFT + CELL_PAD + indent, yTop + 6, { width: labelWidth })

  if (amount !== null) {
    doc
      .fillColor(options.accent ? PDF_COLORS.primary : textColor)
      .text(formatCurrency(amount), DIVIDER_X + CELL_PAD, yTop + 6, {
        width: AMOUNT_WIDTH - CELL_PAD,
        align: "right",
      })
  }

  if (options.note) {
    doc
      .font("Helvetica")
      .fontSize(noteFontSize)
      .fillColor(PDF_COLORS.mutedText)
      .text(sanitizeText(options.note), LEFT + CELL_PAD + indent, yTop + 20, { width: labelWidth })
  }

  drawRowBorders(doc, yTop, height, { heavyTop: options.heavyTop })
  cursor.y = yTop + height
}

function drawSectionHeading(doc: PdfDoc, cursor: Cursor, text: string) {
  ensureSpace(doc, cursor, 28)
  cursor.y += 6
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(PDF_COLORS.sectionText)
    .text(text, LEFT, cursor.y)
  cursor.y += 20
}

function createDoc() {
  if (!PDFDocument) {
    throw new Error("Unable to load pdfkit constructor")
  }
  const doc = new PDFDocument({ margin: 48, size: "A4" }) as unknown as PdfDoc
  const chunks: Buffer[] = []
  doc.on("data", (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })
  return { doc, done }
}

export function generateIncomeStatementPDF(
  payload: IncomeStatementPdfPayload,
  storeInfo: StoreInfo
) {
  const { doc, done } = createDoc()
  const start = drawHeader(
    doc,
    storeInfo,
    "Income Statement",
    `${payload.range.from} to ${payload.range.to}`,
    payload.generatedAt
  )
  const cursor: Cursor = { y: start }
  const s = payload.statement

  drawTableHeader(doc, cursor)
  drawTableRow(doc, cursor, "Revenue", s.revenue, { muted: true })
  drawTableRow(doc, cursor, "Cost of Goods Sold", -s.costOfGoodsSold, {
    muted: true,
    fill: PDF_COLORS.rowAlt,
  })
  drawTableRow(doc, cursor, "Gross Profit", s.grossProfit, {
    bold: true,
    fill: PDF_COLORS.tableHeader,
    heavyTop: "border",
  })
  drawTableRow(doc, cursor, "Operating Expenses", -s.operatingExpenses, {
    muted: true,
    fill: PDF_COLORS.rowAlt,
  })
  drawTableRow(doc, cursor, "Net Profit", s.netProfit, {
    bold: true,
    accent: true,
    fill: PDF_COLORS.tableHeader,
    heavyTop: "accent",
  })

  doc.end()
  return done
}

// Renders one bordered balance-sheet section: a section heading, a column header,
// each line group as a band plus its lines, and a closing total row.
function drawBalanceSection(
  doc: PdfDoc,
  cursor: Cursor,
  heading: string,
  groups: Array<{ heading: string; lines: BalanceSheetLine[] }>,
  totalLabel: string,
  totalAmount: number
) {
  drawSectionHeading(doc, cursor, heading)
  drawTableHeader(doc, cursor)
  for (const group of groups) {
    drawBandRow(doc, cursor, group.heading)
    if (group.lines.length === 0) {
      drawTableRow(doc, cursor, "None recorded.", null, { muted: true, indent: 8 })
      continue
    }
    group.lines.forEach((line, index) => {
      drawTableRow(doc, cursor, line.label, line.amount, {
        indent: 8,
        muted: true,
        note: line.note,
        fill: index % 2 === 1 ? PDF_COLORS.rowAlt : undefined,
      })
    })
  }
  drawTableRow(doc, cursor, totalLabel, totalAmount, {
    bold: true,
    fill: PDF_COLORS.tableHeader,
    heavyTop: "border",
  })
}

export function generateBalanceSheetPDF(
  payload: BalanceSheetPdfPayload,
  storeInfo: StoreInfo
) {
  const { doc, done } = createDoc()
  const start = drawHeader(
    doc,
    storeInfo,
    "Balance Sheet",
    `As of ${payload.asOf}`,
    payload.generatedAt
  )
  const cursor: Cursor = { y: start }
  const sheet = payload.sheet

  drawBalanceSection(
    doc,
    cursor,
    "Assets",
    [
      { heading: "Current Assets", lines: sheet.assets.current },
      { heading: "Fixed Assets", lines: sheet.assets.fixed },
    ],
    "Total Assets",
    sheet.assets.total
  )

  drawBalanceSection(
    doc,
    cursor,
    "Liabilities",
    [
      { heading: "Current Liabilities", lines: sheet.liabilities.current },
      { heading: "Long-term Liabilities", lines: sheet.liabilities.longTerm },
    ],
    "Total Liabilities",
    sheet.liabilities.total
  )

  drawBalanceSection(
    doc,
    cursor,
    "Equity",
    [{ heading: "Equity", lines: sheet.equity.lines }],
    "Total Equity",
    sheet.equity.total
  )

  cursor.y += 10
  drawTableRow(
    doc,
    cursor,
    "Total Liabilities + Equity",
    sheet.totalLiabilitiesAndEquity,
    { bold: true, accent: true, fill: PDF_COLORS.tableHeader, heavyTop: "accent" }
  )
  drawTableRow(
    doc,
    cursor,
    "Balance Check (Assets − Liabilities − Equity)",
    sheet.balanceDifference,
    { muted: true }
  )

  cursor.y += 16
  ensureSpace(doc, cursor)
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(PDF_COLORS.text)
    .text(THANK_YOU_LINE, LEFT, cursor.y, { align: "center", width: RIGHT - LEFT })

  doc.end()
  return done
}
