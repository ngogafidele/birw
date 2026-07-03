"use client"

// Implements initial administrator account setup for a new installation.
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  PackageCheck,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react"
import { type FormEvent, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function SetupAdminPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSetup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    if (password !== confirmPassword) {
      setMessage("Admin setup passwords do not match.")
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        })

        const data = await response.json()
        if (!response.ok) {
          setMessage(data?.error ?? "Setup failed")
          return
        }

        router.push("/dashboard")
        router.refresh()
      } catch (error) {
        setMessage("Network error. Check your connection and try again.")
      }
    })
  }

  const setupSteps = [
    "Create one trusted administrator account.",
    "Sign in automatically when setup is complete.",
    "Invite or manage staff from the authenticated workspace.",
  ]

  return (
    <div className="brand-auth-surface min-h-screen">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ zIndex: 0 }}
      >
        <Image
          src="/images/auth-background.webp"
          alt=""
          fill
          priority
          quality={55}
          sizes="100vw"
          className="object-cover opacity-52"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(246,250,246,0.54)_0%,rgba(246,250,246,0.34)_48%,rgba(246,250,246,0.22)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand-green)_6%,transparent),transparent_50%,color-mix(in_srgb,var(--brand-blue)_4%,transparent))]" />
      </div>
      <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[0.96fr_1.04fr] lg:gap-10 lg:px-10">
        <section className="rounded-xl border border-border/80 bg-card/95 p-5 shadow-xl backdrop-blur sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-[var(--brand-gold)] text-[var(--brand-green-deep)] shadow-sm">
                <ShieldCheck className="size-5" />
              </div>
              <h1 className="text-2xl font-semibold text-[var(--brand-green-deep)]">
                Create admin account
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This creates the first administrator and signs you in when
                setup is complete.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="h-10 shrink-0 border-[var(--brand-green)]/25 bg-[var(--brand-green)]/10 font-semibold text-[var(--brand-green-deep)] hover:bg-[var(--brand-green)] hover:text-white"
            >
              <Link href="/">
                <ArrowLeft className="size-4" />
                Login
              </Link>
            </Button>
          </div>

          <div className="mb-6 grid gap-2 rounded-xl border border-[var(--brand-green)]/20 bg-[var(--brand-green-soft)]/70 p-4">
            {setupSteps.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-[var(--brand-blue)]" />
                <span className="text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>

          {message ? (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {message}
            </div>
          ) : null}

          <form
            className="space-y-4"
            autoComplete="off"
            onSubmit={handleSetup}
          >
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Full name
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pl-9"
                  placeholder="Admin name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </label>
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Admin email
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pl-9"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
            </label>
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Password
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pl-9 pr-11"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="off"
                  name="inventory-admin-passcode"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-muted-foreground transition hover:text-foreground"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </label>
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Confirm password
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pl-9 pr-11"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="off"
                  name="inventory-admin-passcode-confirm"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-muted-foreground transition hover:text-foreground"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </label>

            <Button
              className="h-11 w-full bg-[var(--brand-green)] font-semibold text-white hover:bg-[var(--brand-green-deep)]"
              disabled={isPending}
            >
              {isPending ? "Creating admin..." : "Create admin"}
            </Button>
          </form>
        </section>

        <section className="space-y-6">
          <div className="max-w-2xl">
            <div className="mb-5 flex items-center gap-4">
              <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--brand-green)]/20 bg-white shadow-sm">
                <Image
                  src="/images/logo.webp"
                  alt="BIRW logo"
                  width={96}
                  height={96}
                  priority
                  className="h-full w-full object-contain p-2"
                />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase text-[var(--brand-blue-deep)]">
                  Initial system setup
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--brand-charcoal)]">
                  BIRW INVESTMENT GROUP Ltd
                </p>
              </div>
            </div>
            <h2 className="text-3xl font-semibold leading-tight text-[var(--brand-green-deep)] sm:text-5xl">
              One admin opens the whole workspace.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              The first account controls users, stock corrections, reporting,
              and the operating setup for the BIRW store.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Store", icon: Store },
              { label: "Inventory", icon: PackageCheck },
              { label: "Reports", icon: ClipboardList },
            ].map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--brand-green)]/20 bg-white/80 p-4 text-sm shadow-sm"
              >
                <Icon className="mb-3 size-5 text-[var(--brand-blue)]" />
                <p className="font-semibold text-[var(--brand-green-deep)]">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {[
              "Secure access for BIRW daily operations.",
              "Store teams start from one trusted admin account.",
              "Inventory, sales, invoices, and alerts stay connected.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-xl border border-[var(--brand-green)]/20 bg-white/75 p-4 text-sm text-muted-foreground shadow-sm"
              >
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--brand-blue)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
