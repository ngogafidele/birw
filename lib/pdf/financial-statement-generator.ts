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
const AMOUNT_X = 400
const AMOUNT_WIDTH = RIGHT - AMOUNT_X
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

function drawLine(
  doc: PdfDoc,
  cursor: Cursor,
  label: string,
  amount: number,
  options: {
    indent?: number
    bold?: boolean
    muted?: boolean
    rule?: boolean
    accent?: boolean
    note?: string
  } = {}
) {
  ensureSpace(doc, cursor)
  const indent = options.indent ?? 0
  if (options.rule) {
    doc
      .moveTo(LEFT, cursor.y)
      .lineTo(RIGHT, cursor.y)
      .lineWidth(options.accent ? 1.2 : 0.6)
      .strokeColor(options.accent ? PDF_COLORS.accent : PDF_COLORS.border)
      .stroke()
    cursor.y += 8
  }

  const font = options.bold ? "Helvetica-Bold" : "Helvetica"
  const color = options.muted ? PDF_COLORS.mutedText : PDF_COLORS.text
  doc
    .font(font)
    .fontSize(options.bold ? 11 : 10)
    .fillColor(color)
    .text(label, LEFT + indent, cursor.y, { width: AMOUNT_X - LEFT - indent })
    .text(formatCurrency(amount), AMOUNT_X, cursor.y, {
      width: AMOUNT_WIDTH,
      align: "right",
    })

  if (options.note) {
    cursor.y += 14
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(PDF_COLORS.mutedText)
      .text(options.note, LEFT + indent, cursor.y, { width: AMOUNT_X - LEFT - indent })
  }
  cursor.y += 20
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

function drawSubHeading(doc: PdfDoc, cursor: Cursor, text: string) {
  ensureSpace(doc, cursor)
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(PDF_COLORS.mutedText)
    .text(text.toUpperCase(), LEFT, cursor.y)
  cursor.y += 16
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

  drawLine(doc, cursor, "Revenue", s.revenue, { muted: true })
  drawLine(doc, cursor, "Cost of Goods Sold", -s.costOfGoodsSold, { muted: true })
  drawLine(doc, cursor, "Gross Profit", s.grossProfit, { bold: true, rule: true })
  drawLine(doc, cursor, "Operating Expenses", -s.operatingExpenses, { muted: true })
  drawLine(doc, cursor, "Net Profit", s.netProfit, {
    bold: true,
    rule: true,
    accent: true,
  })

  doc.end()
  return done
}

function drawLineGroup(
  doc: PdfDoc,
  cursor: Cursor,
  heading: string,
  lines: BalanceSheetLine[]
) {
  drawSubHeading(doc, cursor, heading)
  if (lines.length === 0) {
    ensureSpace(doc, cursor)
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(PDF_COLORS.mutedText)
      .text("None recorded.", LEFT + 12, cursor.y)
    cursor.y += 18
    return
  }
  for (const line of lines) {
    drawLine(doc, cursor, line.label, line.amount, {
      indent: 12,
      muted: true,
      note: line.note,
    })
  }
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

  drawSectionHeading(doc, cursor, "Assets")
  drawLineGroup(doc, cursor, "Current Assets", sheet.assets.current)
  drawLineGroup(doc, cursor, "Fixed Assets", sheet.assets.fixed)
  drawLine(doc, cursor, "Total Assets", sheet.assets.total, {
    bold: true,
    rule: true,
  })

  drawSectionHeading(doc, cursor, "Liabilities")
  drawLineGroup(doc, cursor, "Current Liabilities", sheet.liabilities.current)
  drawLineGroup(doc, cursor, "Long-term Liabilities", sheet.liabilities.longTerm)
  drawLine(doc, cursor, "Total Liabilities", sheet.liabilities.total, {
    bold: true,
    rule: true,
  })

  drawSectionHeading(doc, cursor, "Equity")
  drawLineGroup(doc, cursor, "Equity", sheet.equity.lines)
  drawLine(doc, cursor, "Total Equity", sheet.equity.total, {
    bold: true,
    rule: true,
  })

  drawLine(
    doc,
    cursor,
    "Total Liabilities + Equity",
    sheet.totalLiabilitiesAndEquity,
    { bold: true, rule: true, accent: true }
  )
  drawLine(doc, cursor, "Balance Check (Assets − Liabilities − Equity)", sheet.balanceDifference, {
    muted: true,
  })

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
