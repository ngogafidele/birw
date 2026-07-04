"use client"

// Manages product records, catalog actions, and branch inventory display.
import { useMemo, useState } from "react"
import { formatCurrency } from "@/lib/utils/format"
import { formatBusinessDateInput } from "@/lib/utils/time"
import { Activity, FileText, PackagePlus, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ProductMonitorDialog,
  type MonitorProduct,
} from "@/components/products/product-monitor-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ProductClient = {
  _id: string
  name: string
  sku: string
  unit: string
  quantity: number
  lowStockThreshold: number
  costPrice: number
  price: number
  lastRestock?: string
  lastRestockLabel?: string
  supplierName?: string
  createdAt?: string
  updatedAt?: string
}

export type ProductsManagerProps = {
  initialProducts: ProductClient[]
  isAdmin: boolean
}

type FormState = {
  name: string
  sku: string
  unit: string
  quantity: string
  lowStockThreshold: string
  costPrice: string
  price: string
  supplierName: string
  supplierPhone: string
}

type ReceiveFormState = {
  supplierName: string
  supplierPhone: string
  quantity: string
  unitCost: string
  receivedAt: string
}

const emptyForm: FormState = {
  name: "",
  sku: "",
  unit: "",
  quantity: "",
  lowStockThreshold: "",
  costPrice: "",
  price: "",
  supplierName: "",
  supplierPhone: "",
}

// One row in the multi-product create form, carrying its own submit error.
type CreateEntry = FormState & { _error?: string }

function makeEntry(): CreateEntry {
  return { ...emptyForm }
}

// Shared product field grid used by both the edit form and each create row.
function ProductFields({
  value,
  onChange,
  showSupplier,
}: {
  value: FormState
  onChange: (patch: Partial<FormState>) => void
  showSupplier: boolean
}) {
  const cost = Number(value.costPrice)
  const price = Number(value.price)
  const showPriceWarning =
    value.costPrice.trim() !== "" &&
    value.price.trim() !== "" &&
    !Number.isNaN(cost) &&
    !Number.isNaN(price) &&
    price < cost

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Name
        <Input
          value={value.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Unit
        <Input
          placeholder="pcs, kg, l, box"
          value={value.unit}
          onChange={(event) => onChange({ unit: event.target.value })}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Quantity
          <Input
            type="number"
            min={0}
            placeholder="e.g. 120"
            value={value.quantity}
            onChange={(event) => onChange({ quantity: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Low Stock Threshold (optional)
          <Input
            type="number"
            min={0}
            placeholder="Defaults to 0"
            value={value.lowStockThreshold}
            onChange={(event) =>
              onChange({ lowStockThreshold: event.target.value })
            }
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Cost Price
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="e.g. 850"
            value={value.costPrice}
            onChange={(event) => onChange({ costPrice: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Selling Price
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="e.g. 1000"
            value={value.price}
            onChange={(event) => onChange({ price: event.target.value })}
          />
          {showPriceWarning ? (
            <span className="text-xs text-amber-600">
              Warning: selling price is below cost price.
            </span>
          ) : null}
        </label>
      </div>
      {showSupplier ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Supplier name
            <Input
              value={value.supplierName}
              onChange={(event) =>
                onChange({ supplierName: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1 text-sm">
            Supplier phone
            <Input
              value={value.supplierPhone}
              onChange={(event) =>
                onChange({ supplierPhone: event.target.value })
              }
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}

function getEmptyReceiveForm(): ReceiveFormState {
  return {
    supplierName: "",
    supplierPhone: "",
    quantity: "",
    unitCost: "",
    receivedAt: formatBusinessDateInput(new Date()),
  }
}

const PRODUCTS_PER_PAGE = 20

export function ProductsManager({
  initialProducts,
  isAdmin,
}: ProductsManagerProps) {
  const [products, setProducts] = useState(initialProducts)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [entries, setEntries] = useState<CreateEntry[]>([makeEntry()])
  const [activeProductId, setActiveProductId] = useState<string | null>(null)
  const [receiveProduct, setReceiveProduct] = useState<ProductClient | null>(
    null
  )
  const [receiveForm, setReceiveForm] =
    useState<ReceiveFormState>(getEmptyReceiveForm)
  const [monitorProduct, setMonitorProduct] = useState<MonitorProduct | null>(
    null
  )
  const [monitorOpen, setMonitorOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [catalogDownloading, setCatalogDownloading] = useState(false)

  const receiveQuantityValue = Number(receiveForm.quantity)
  const receiveUnitCostValue = Number(receiveForm.unitCost)
  const receiveTotal =
    Number.isFinite(receiveQuantityValue) &&
    Number.isFinite(receiveUnitCostValue)
      ? Math.max(0, receiveQuantityValue) * Math.max(0, receiveUnitCostValue)
      : 0

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        (product.unit ?? "").toLowerCase().includes(query)
      )
    })
  }, [products, search])

  const pageCount = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
  )
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pageStart = (safeCurrentPage - 1) * PRODUCTS_PER_PAGE
  const paginatedProducts = filteredProducts.slice(
    pageStart,
    pageStart + PRODUCTS_PER_PAGE
  )
  const visibleStart = filteredProducts.length === 0 ? 0 : pageStart + 1
  const visibleEnd = Math.min(
    pageStart + PRODUCTS_PER_PAGE,
    filteredProducts.length
  )

  const resetForm = () => {
    setFormState({
      ...emptyForm,
    })
    setEntries([makeEntry()])
    setActiveProductId(null)
    setError(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const updateEntry = (index: number, patch: Partial<FormState>) => {
    setEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch, _error: undefined } : entry
      )
    )
  }

  const addEntry = () => {
    setEntries((current) => [...current, makeEntry()])
  }

  const removeEntry = (index: number) => {
    setEntries((current) =>
      current.length > 1
        ? current.filter((_, entryIndex) => entryIndex !== index)
        : current
    )
  }

  const openEdit = (product: ProductClient) => {
    setFormState({
      name: product.name,
      sku: product.sku,
      unit: product.unit ?? "pcs",
      quantity: String(product.quantity ?? 0),
      lowStockThreshold: String(product.lowStockThreshold ?? 0),
      costPrice: String(product.costPrice ?? 0),
      price: String(product.price ?? 0),
      supplierName: "",
      supplierPhone: "",
    })
    setActiveProductId(product._id)
    setError(null)
    setDialogOpen(true)
  }

  const openMonitor = (product: ProductClient) => {
    setMonitorProduct({
      _id: product._id,
      name: product.name,
      sku: product.sku,
      unit: product.unit ?? "pcs",
    })
    setMonitorOpen(true)
  }

  const openReceive = (product: ProductClient) => {
    setReceiveProduct(product)
    setReceiveForm({
      ...getEmptyReceiveForm(),
      unitCost: String(product.costPrice ?? 0),
    })
    setError(null)
    setReceiveDialogOpen(true)
  }

  const submitReceive = async () => {
    if (!receiveProduct) return

    const supplierName = receiveForm.supplierName.trim()
    const supplierPhone = receiveForm.supplierPhone.trim()
    const quantity = Number(receiveForm.quantity)
    const unitCost = Number(receiveForm.unitCost)

    if (!supplierName || !supplierPhone || !receiveForm.receivedAt) {
      setError("Supplier name, phone, and received date are required.")
      return
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      Number.isNaN(unitCost) ||
      unitCost < 0
    ) {
      setError("Quantity must be at least 1 and cost must be 0 or more.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/products/${receiveProduct._id}/receipts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierName,
            supplierPhone,
            quantity,
            unitCost,
            receivedAt: receiveForm.receivedAt,
          }),
        }
      )
      const body = await response.json()

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to receive product.")
        return
      }

      const updatedProduct = body.data.product as ProductClient
      const receipt = body.data.receipt as
        | { supplierName?: string; receivedAt?: string }
        | undefined
      setProducts((current) =>
        current.map((product) =>
          product._id === receiveProduct._id
            ? {
                ...updatedProduct,
                lastRestock: receipt?.receivedAt,
                lastRestockLabel: receiveForm.receivedAt,
                supplierName: receipt?.supplierName ?? supplierName,
              }
            : product
        )
      )
      setReceiveDialogOpen(false)
      setReceiveProduct(null)
      setReceiveForm(getEmptyReceiveForm())
    } catch {
      setError("Failed to receive product.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitEdit = async () => {
    if (!activeProductId) return

    const trimmedName = formState.name.trim()
    const trimmedUnit = formState.unit.trim()

    if (!trimmedName || !trimmedUnit) {
      setError("Please fill all required fields.")
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      name: trimmedName,
      unit: trimmedUnit,
      quantity: Number(formState.quantity || 0),
      lowStockThreshold: Number(formState.lowStockThreshold || 0),
      costPrice: Number(formState.costPrice || 0),
      price: Number(formState.price || 0),
    }

    try {
      const response = await fetch(`/api/products/${activeProductId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to save product.")
        return
      }

      const updated = body.data as ProductClient
      setProducts((current) =>
        current.map((item) => (item._id === activeProductId ? updated : item))
      )

      setDialogOpen(false)
      resetForm()
    } catch {
      setError("Failed to save product.")
    } finally {
      setSubmitting(false)
    }
  }

  // Creates every filled row, reusing the single-product endpoint per entry so
  // SKU generation, supplier receipts, and low-stock sync stay identical.
  const submitCreate = async () => {
    const prepared = entries.map((entry) => {
      const name = entry.name.trim()
      const unit = entry.unit.trim()
      const supplierName = entry.supplierName.trim()
      const supplierPhone = entry.supplierPhone.trim()

      let validationError: string | null = null
      if (!name || !unit) {
        validationError = "Name and unit are required."
      } else if (Boolean(supplierName) !== Boolean(supplierPhone)) {
        validationError = "Supplier name and phone must be provided together."
      }

      return { entry, name, unit, supplierName, supplierPhone, validationError }
    })

    if (prepared.some((item) => item.validationError)) {
      setEntries(
        prepared.map((item) => ({
          ...item.entry,
          _error: item.validationError ?? undefined,
        }))
      )
      setError("Fix the highlighted rows before saving.")
      return
    }

    setSubmitting(true)
    setError(null)

    const created: ProductClient[] = []
    const failed: CreateEntry[] = []

    for (const item of prepared) {
      const quantity = Number(item.entry.quantity || 0)
      const payload = {
        name: item.name,
        unit: item.unit,
        quantity,
        lowStockThreshold: Number(item.entry.lowStockThreshold || 0),
        costPrice: Number(item.entry.costPrice || 0),
        price: Number(item.entry.price || 0),
        ...(item.supplierName && item.supplierPhone
          ? { supplierName: item.supplierName, supplierPhone: item.supplierPhone }
          : {}),
      }

      try {
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const body = await response.json()

        if (!response.ok || !body?.success) {
          failed.push({
            ...item.entry,
            _error: body?.error ?? "Failed to create product.",
          })
          continue
        }

        const updated = body.data as ProductClient
        created.push(
          item.supplierName && item.supplierPhone && updated.quantity > 0
            ? {
                ...updated,
                lastRestock: new Date().toISOString(),
                lastRestockLabel: "Today",
                supplierName: item.supplierName,
              }
            : updated
        )
      } catch {
        failed.push({ ...item.entry, _error: "Failed to create product." })
      }
    }

    if (created.length > 0) {
      setProducts((current) => [...created, ...current])
      setCurrentPage(1)
    }

    setSubmitting(false)

    if (failed.length === 0) {
      setDialogOpen(false)
      resetForm()
      return
    }

    setEntries(failed)
    setError(
      created.length > 0
        ? `Created ${created.length} product${
            created.length === 1 ? "" : "s"
          }. ${failed.length} still need attention.`
        : "No products were created. Fix the errors below."
    )
  }

  const submitForm = () => (activeProductId ? submitEdit() : submitCreate())

  const handleDelete = async (productId: string) => {
    if (!confirm("Delete this product?")) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      })
      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to delete product.")
        return
      }

      setProducts((current) =>
        current.filter((product) => product._id !== productId)
      )
    } catch {
      setError("Failed to delete product.")
    } finally {
      setSubmitting(false)
    }
  }

  const produceCatalogPdf = async () => {
    setCatalogDownloading(true)
    setError(null)

    try {
      const response = await fetch("/api/products/catalog/pdf")

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Failed to download catalog PDF.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const disposition = response.headers.get("content-disposition")
      const filename =
        disposition?.match(/filename="(.+)"/)?.[1] ?? "products-catalog.pdf"
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError("Failed to download catalog PDF.")
    } finally {
      setCatalogDownloading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Catalog
          </p>
          <h2 className="text-2xl font-semibold">Products</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search products"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setCurrentPage(1)
            }}
            className="w-full sm:w-56"
          />
          <Button
            variant="outline"
            onClick={produceCatalogPdf}
            disabled={catalogDownloading}
          >
            <FileText className="size-4" />
            {catalogDownloading ? "Preparing..." : "Catalog PDF"}
          </Button>
          {isAdmin ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>Add Products</Button>
              </DialogTrigger>
              <DialogContent
                className={
                  activeProductId
                    ? undefined
                    : "max-h-[90vh] overflow-y-auto sm:max-w-2xl"
                }
              >
                <DialogHeader>
                  <DialogTitle>
                    {activeProductId ? "Edit product" : "Add products"}
                  </DialogTitle>
                </DialogHeader>
                {activeProductId ? (
                  <div className="grid gap-3">
                    <ProductFields
                      value={formState}
                      onChange={(patch) =>
                        setFormState((prev) => ({ ...prev, ...patch }))
                      }
                      showSupplier={false}
                    />
                    {error ? (
                      <p className="text-sm text-destructive">{error}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {entries.map((entry, index) => (
                      <div
                        key={index}
                        className="grid gap-3 rounded-xl border border-border p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-muted-foreground">
                            Product {index + 1}
                          </p>
                          {entries.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeEntry(index)}
                              aria-label={`Remove product ${index + 1}`}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                        <ProductFields
                          value={entry}
                          onChange={(patch) => updateEntry(index, patch)}
                          showSupplier
                        />
                        {entry._error ? (
                          <p className="text-sm text-destructive">
                            {entry._error}
                          </p>
                        ) : null}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addEntry}
                      className="justify-center"
                    >
                      <Plus className="size-4" />
                      Add another product
                    </Button>
                    {error ? (
                      <p className="text-sm text-destructive">{error}</p>
                    ) : null}
                  </div>
                )}
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={submitForm} disabled={submitting}>
                    {submitting
                      ? "Saving..."
                      : activeProductId
                      ? "Save changes"
                      : entries.length > 1
                      ? `Create ${entries.length} products`
                      : "Create product"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Dialog
        open={receiveDialogOpen}
        onOpenChange={(open) => {
            setReceiveDialogOpen(open)
          if (!open) {
            setReceiveProduct(null)
            setReceiveForm(getEmptyReceiveForm())
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Receive {receiveProduct?.name ?? "product"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Supplier name
              <Input
                value={receiveForm.supplierName}
                onChange={(event) =>
                  setReceiveForm((prev) => ({
                    ...prev,
                    supplierName: event.target.value,
                  }))
                }
              />
            </label>
            <label className="grid gap-1 text-sm">
              Supplier phone
              <Input
                value={receiveForm.supplierPhone}
                onChange={(event) =>
                  setReceiveForm((prev) => ({
                    ...prev,
                    supplierPhone: event.target.value,
                  }))
                }
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Quantity
                <Input
                  type="number"
                  min={1}
                  value={receiveForm.quantity}
                  onChange={(event) =>
                    setReceiveForm((prev) => ({
                      ...prev,
                      quantity: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1 text-sm">
                Unit cost
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={receiveForm.unitCost}
                  onChange={(event) =>
                    setReceiveForm((prev) => ({
                      ...prev,
                      unitCost: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              Received date
              <Input
                type="date"
                value={receiveForm.receivedAt}
                onChange={(event) =>
                  setReceiveForm((prev) => ({
                    ...prev,
                    receivedAt: event.target.value,
                  }))
                }
              />
            </label>
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Supplied goods cost</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(receiveTotal)}
              </span>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReceiveDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submitReceive} disabled={submitting}>
              {submitting ? "Receiving..." : "Receive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ProductMonitorDialog
        product={monitorProduct}
        open={monitorOpen}
        onOpenChange={(open) => {
          setMonitorOpen(open)
          if (!open) setMonitorProduct(null)
        }}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Low Stock Threshold</TableHead>
            <TableHead>Cost Price</TableHead>
            <TableHead>Selling Price</TableHead>
            <TableHead>Last Restock</TableHead>
            <TableHead>Supplier</TableHead>
            {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedProducts.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isAdmin ? 10 : 9}
                className="text-muted-foreground"
              >
                No products found.
              </TableCell>
            </TableRow>
          ) : (
            paginatedProducts.map((product, productIndex) => (
              <TableRow
                key={product._id.toString()}
                className={
                  productIndex % 2 === 1
                    ? "bg-muted/60 hover:bg-muted/70"
                    : undefined
                }
              >
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.sku}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{product.quantity}</span>
                    {product.quantity <= (product.lowStockThreshold ?? 0) ? (
                      <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Low
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{product.unit ?? "pcs"}</TableCell>
                <TableCell>{product.lowStockThreshold ?? 0}</TableCell>
                <TableCell>{formatCurrency(product.costPrice ?? 0)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{formatCurrency(product.price)}</span>
                    {product.price < (product.costPrice ?? 0) ? (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Below cost
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{product.lastRestockLabel ?? "-"}</TableCell>
                <TableCell>{product.supplierName ?? "-"}</TableCell>
                {isAdmin ? (
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openMonitor(product)}
                      >
                        <Activity className="size-4" />
                        Monitor
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReceive(product)}
                        disabled={submitting}
                      >
                        <PackagePlus className="size-4" />
                        Receive
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(product)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(product._id)}
                        disabled={submitting}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex flex-col gap-3 border-t border-border/80 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {visibleStart}-{visibleEnd} of {filteredProducts.length} products
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safeCurrentPage === 1}
          >
            Previous
          </Button>
          <span className="min-w-20 text-center">
            Page {safeCurrentPage} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((page) => Math.min(pageCount, page + 1))
            }
            disabled={safeCurrentPage === pageCount}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
