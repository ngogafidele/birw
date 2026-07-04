// Renders sales invoice and proforma PDF documents using branch identity.
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

type PdfDiscount = {
  type: "percentage" | "amount"
  value: number
  amount: number
}

type PdfItem = {
  description: string
  sku?: string
  unit?: string
  quantity: number
  unitPrice: number
  discount?: PdfDiscount
  lineTotal: number
}

type PdfDocumentData = {
  number: string
  date?: Date | string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  status?: string
  subtotalAmount?: number
  discount?: PdfDiscount
  totalAmount: number
  items: PdfItem[]
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

type InvoicePdfDocument = {
  rect(x: number, y: number, width: number, height: number): InvoicePdfDocument
  fillColor(color: string): InvoicePdfDocument
  fill(): InvoicePdfDocument
  image(
    src: string | Buffer,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number; fit?: [number, number] }
  ): InvoicePdfDocument
  font(name: string): InvoicePdfDocument
  fontSize(size: number): InvoicePdfDocument
  text(
    text: string,
    x?: number,
    y?: number,
    options?: { align?: "left" | "right" | "center"; width?: number }
  ): InvoicePdfDocument
  widthOfString(text: string): number
}

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")
const stampPath = path.join(process.cwd(), "public", "images", "stamp.jpg")
const logoBox = {
  x: 42,
  y: 24,
  width: 120,
  height: 120,
  imageX: 48,
  imageY: 30,
  imageFit: [108, 108] as [number, number],
}

const stampBox = {
  x: 438,
  width: 78,
  height: 78,
  fit: [78, 78] as [number, number],
}

const TABLE_ROW_HEIGHT = 24
const PAYMENT_DETAILS_WIDTH = 360
const THANK_YOU_LINE = "Thank you for doing business with us."

function mutedText(doc: InvoicePdfDocument) {
  return doc.font("Helvetica-Bold").fillColor(PDF_COLORS.mutedText)
}

function boldText(doc: InvoicePdfDocument) {
  return doc.font("Helvetica-Bold").fillColor(PDF_COLORS.text)
}

function getLogoBuffer() {
  if (!existsSync(logoPath)) return null
  return readFileSync(logoPath)
}

function getStampBuffer() {
  if (!existsSync(stampPath)) return null
  return readFileSync(stampPath)
}

function drawLogo(doc: InvoicePdfDocument, storeInfo: StoreInfo) {
  doc
    .rect(logoBox.x, logoBox.y, logoBox.width, logoBox.height)
    .fillColor(PDF_COLORS.surface)
    .fill()

  const logoBuffer = getLogoBuffer()
  try {
    if (!logoBuffer) throw new Error("Logo not found")
    doc.image(logoBuffer, logoBox.imageX, logoBox.imageY, {
      fit: logoBox.imageFit,
    })
    return
  } catch (bufferError) {
    try {
      doc.image(logoPath, logoBox.imageX, logoBox.imageY, {
        fit: logoBox.imageFit,
      })
      return
    } catch (pathError) {
      console.error("[Invoice PDF Logo Error]", {
        buffer:
          bufferError instanceof Error
            ? bufferError.message
            : "Failed to load logo buffer",
        path:
          pathError instanceof Error
            ? pathError.message
            : "Failed to load logo path",
        logoPath,
      })
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(PDF_COLORS.headerText)
        .text(storeInfo.name ?? "Inventory", 48, 72, { width: 150 })
    }
  }
}

function drawStamp(doc: InvoicePdfDocument, y: number) {
  const stampBuffer = getStampBuffer()
  const stampY = y + 34

  try {
    if (!stampBuffer) throw new Error("Stamp not found")
    doc.image(stampBuffer, stampBox.x, stampY, { fit: stampBox.fit })
  } catch (bufferError) {
    try {
      doc.image(stampPath, stampBox.x, stampY, { fit: stampBox.fit })
    } catch (pathError) {
      console.error("[Invoice PDF Stamp Error]", {
        buffer:
          bufferError instanceof Error
            ? bufferError.message
            : "Failed to load stamp buffer",
        path:
          pathError instanceof Error
            ? pathError.message
            : "Failed to load stamp path",
        stampPath,
      })
    }
  }
}

function formatDate(value: Date | string | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-RW", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value))
}

function truncateToWidth(
  doc: InvoicePdfDocument,
  value: string | undefined,
  width: number
) {
  const text = value?.trim() || "-"
  if (doc.widthOfString(text) <= width) return text

  const suffix = "..."
  const suffixWidth = doc.widthOfString(suffix)
  let start = 0
  let end = text.length

  while (start < end) {
    const mid = Math.ceil((start + end) / 2)
    if (doc.widthOfString(text.slice(0, mid)) + suffixWidth <= width) {
      start = mid
    } else {
      end = mid - 1
    }
  }

  return `${text.slice(0, start).trimEnd()}${suffix}`
}

function writeInvoicePdf(
  title: string,
  data: PdfDocumentData,
  storeInfo: StoreInfo,
  recipientLabel = "Bill To",
  footerLines: string[] = [],
  centeredFooterLine?: string,
  showDiscountColumn = false
) {
  if (!PDFDocument) {
    const keys =
      typeof PDFKitModule === "object" && PDFKitModule !== null
        ? Object.keys(PDFKitModule).join(", ")
        : typeof PDFKitModule
    throw new Error(`Unable to load pdfkit constructor. Exports: ${keys}`)
  }

  const doc = new PDFDocument({ margin: 48, size: "A4" })
  const chunks: Buffer[] = []

  doc.on("data", (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  drawLogo(doc, storeInfo)

  boldText(doc)
    .fontSize(22)
    .text(title, 340, 58, { align: "right" })
  mutedText(doc)
    .fontSize(10)
    .text(data.number, 340, 88, { align: "right" })
    .text(`Date: ${formatDate(data.date)}`, 340, 104, { align: "right" })

  if (data.status) {
    doc.text(`Status: ${data.status}`, 340, 120, { align: "right" })
  }

  doc
    .moveTo(48, 210)
    .lineTo(547, 210)
    .lineWidth(1.5)
    .strokeColor(PDF_COLORS.accent)
    .stroke()

  boldText(doc)
    .fontSize(11)
    .text(storeInfo.name ?? "BIRW INVESTMENT GROUP Ltd", 48, 230)
  mutedText(doc)
    .fontSize(9)
    .text(storeInfo.tin ? `TIN: ${storeInfo.tin}` : "", 48, 248)
    .text(storeInfo.phone ?? "", 48, 262)
    .text(storeInfo.address ?? "", 48, 276)
    .text(storeInfo.email ?? "", 48, 290)

  boldText(doc)
    .fontSize(11)
    .text(recipientLabel, 330, 230)
  mutedText(doc)
    .fontSize(9)
    .text(data.customerName, 330, 248)
    .text(data.customerEmail ?? "", 330, 262)
    .text(data.customerPhone ?? "", 330, 276)

  const tableTop = 320
  const columns = showDiscountColumn
    ? {
        no: 52,
        item: 78,
        itemWidth: 148,
        quantity: 230,
        qtyWidth: 50,
        price: 288,
        priceWidth: 66,
        discount: 360,
        discountWidth: 78,
        total: 444,
        totalWidth: 103,
      }
    : {
        no: 54,
        item: 88,
        itemWidth: 190,
        quantity: 292,
        qtyWidth: 54,
        price: 355,
        priceWidth: 82,
        discount: 0,
        discountWidth: 0,
        total: 448,
        totalWidth: 92,
      }

  doc
    .rect(48, tableTop, 499, 24)
    .fillColor(PDF_COLORS.tableHeader)
    .fill()
    .font("Helvetica-Bold")
    .fillColor(PDF_COLORS.sectionText)
    .fontSize(9)
    .text("NO", columns.no, tableTop + 8, { width: 24 })
    .text("ITEM DESCRIPTION", columns.item, tableTop + 8, {
      width: columns.itemWidth,
    })
    .text("QTY", columns.quantity, tableTop + 8, { width: columns.qtyWidth })
    .text("PRICE", columns.price, tableTop + 8, { width: columns.priceWidth })
    .text("TOTAL", columns.total, tableTop + 8, { width: columns.totalWidth })

  if (showDiscountColumn) {
    doc.text("DISCOUNT", columns.discount, tableTop + 8, {
      width: columns.discountWidth,
    })
  }

  let y = tableTop + 32
  data.items.forEach((item, index) => {
    if (y + TABLE_ROW_HEIGHT > 700) {
      doc.addPage()
      y = 56
    }

    doc.font("Helvetica-Bold").fontSize(7)
    const description = truncateToWidth(doc, item.description, columns.itemWidth)
    doc.font("Helvetica-Bold").fontSize(6)
    const sku = item.sku
      ? truncateToWidth(doc, item.sku, columns.itemWidth)
      : ""

    doc
      .fillColor(index % 2 === 0 ? PDF_COLORS.surface : PDF_COLORS.rowAlt)
      .rect(48, y - 7, 499, TABLE_ROW_HEIGHT)
      .fill()
      .font("Helvetica-Bold")
      .fillColor(PDF_COLORS.text)
      .fontSize(7)
      .text(String(index + 1), columns.no, y, { width: 24 })
      .text(description, columns.item, y, { width: columns.itemWidth })
      .fillColor(PDF_COLORS.mutedText)
      .fontSize(6)
      .text(sku, columns.item, y + 10, { width: columns.itemWidth })
      .font("Helvetica-Bold")
      .fillColor(PDF_COLORS.text)
      .fontSize(7)
      .text(`${item.quantity} ${item.unit ?? "pcs"}`, columns.quantity, y)
      .text(formatCurrency(item.unitPrice), columns.price, y, {
        width: columns.priceWidth,
      })
      .text(formatCurrency(item.lineTotal), columns.total, y, {
        width: columns.totalWidth,
      })

    if (showDiscountColumn) {
      const discount = item.discount
      const discountMain = discount
        ? discount.type === "percentage"
          ? `${discount.value}%`
          : `-${formatCurrency(discount.amount)}`
        : "—"

      doc
        .font("Helvetica-Bold")
        .fillColor(PDF_COLORS.text)
        .fontSize(7)
        .text(discountMain, columns.discount, y, {
          width: columns.discountWidth,
        })

      if (discount && discount.type === "percentage") {
        doc
          .fillColor(PDF_COLORS.mutedText)
          .fontSize(6)
          .text(`-${formatCurrency(discount.amount)}`, columns.discount, y + 10, {
            width: columns.discountWidth,
          })
      }
    }

    y += TABLE_ROW_HEIGHT + 2
  })

  // A document-level discount adds Subtotal and Discount rows above Total.
  const documentDiscount = data.discount
  const totalsExtra = documentDiscount ? 34 : 0

  if (y > 660 - totalsExtra) {
    doc.addPage()
    y = 56
  }

  doc
    .moveTo(48, y)
    .lineTo(547, y)
    .strokeColor(PDF_COLORS.border)
    .stroke()

  if (documentDiscount) {
    const subtotal =
      data.subtotalAmount ?? data.totalAmount + documentDiscount.amount
    const discountLabel =
      documentDiscount.type === "percentage"
        ? `Discount (${documentDiscount.value}%)`
        : "Discount"

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(PDF_COLORS.text)
      .text("Subtotal", columns.price, y + 14)
      .text(formatCurrency(subtotal), columns.total, y + 14, {
        width: columns.totalWidth,
      })
      .fillColor(PDF_COLORS.mutedText)
      .text(discountLabel, columns.price, y + 30)
      .text(`-${formatCurrency(documentDiscount.amount)}`, columns.total, y + 30, {
        width: columns.totalWidth,
      })
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(PDF_COLORS.text)
    .text("Total", columns.price, y + 20 + totalsExtra)
    .text(formatCurrency(data.totalAmount), columns.total, y + 20 + totalsExtra, {
      width: columns.totalWidth,
    })

  drawStamp(doc, y + totalsExtra)

  if (footerLines.length > 0) {
    let footerY = y + 58 + totalsExtra
    if (footerY > 700) {
      doc.addPage()
      footerY = 56
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(PDF_COLORS.text)
      .text(footerLines.join("\n"), 48, footerY, {
        width: PAYMENT_DETAILS_WIDTH,
      })

    if (centeredFooterLine) {
      const centeredFooterY = footerY + footerLines.length * 11 + 4

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(PDF_COLORS.text)
        .text(centeredFooterLine, 48, centeredFooterY, {
          align: "center",
          width: 499,
        })
    }
  }

  doc.end()

  return done
}

function getBusinessFooterLines(storeInfo: StoreInfo) {
  return [
    `BPR Bank Accounts: ${storeInfo.bprBankAccounts ?? "-"}`,
    `MoMo: ${storeInfo.momo ?? "-"}`,
  ].filter((line) => line.length > 0)
}

export function generateSalesInvoicePDF(
  invoice: PdfDocumentData,
  storeInfo: StoreInfo
) {
  return writeInvoicePdf(
    "Sales Invoice",
    invoice,
    storeInfo,
    "Bill To",
    getBusinessFooterLines(storeInfo),
    THANK_YOU_LINE
  )
}

export function generateProformaPDF(
  proforma: PdfDocumentData,
  storeInfo: StoreInfo
) {
  return writeInvoicePdf(
    "Proforma Invoice",
    proforma,
    storeInfo,
    "Proforma To",
    getBusinessFooterLines(storeInfo),
    THANK_YOU_LINE,
    true
  )
}
