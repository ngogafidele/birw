"use client"

// Implements the public login entry point for authenticated operations.
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  BellRing,
  ChartNoAxesCombined,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
} from "lucide-react"
import { type FormEvent, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function Home() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        })

        const data = await response.json()
        if (!response.ok) {
          setMessage(data?.error ?? "Login failed")
          return
        }

        router.push("/dashboard")
        router.refresh()
      } catch (error) {
        setMessage("Network error. Check your connection and try again.")
      }
    })
  }

  const workflowHighlights = [
    {
      label: "Stock",
      text: "Track quantities, low-stock alerts, and receiving from one workspace.",
      icon: PackageCheck,
    },
    {
      label: "Sales",
      text: "Record paid sales, customer loans, invoices, and returns.",
      icon: ReceiptText,
    },
    {
      label: "Reports",
      text: "Review daily movement, receivables, and store performance.",
      icon: ChartNoAxesCombined,
    },
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
      <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10 lg:px-10">
        <section className="order-2 space-y-6 lg:order-1">
          <div className="max-w-2xl">
            <div className="mb-5 flex items-center gap-4">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--brand-green)]/20 bg-white shadow-sm">
                <Image
                  src="/images/logo.webp"
                  alt="BIRW logo"
                  width={80}
                  height={80}
                  priority
                  className="h-full w-full object-contain p-2"
                />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase text-[var(--brand-blue-deep)]">
                  BIRW Inventory
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--brand-charcoal)]">
                  BIRW INVESTMENT GROUP Ltd
                </p>
              </div>
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-[var(--brand-green-deep)] sm:text-5xl">
              Store operations, ready from the first sign in.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Manage stock, sales, receivables, invoices, and reports for the
              BIRW store all in one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {workflowHighlights.map(({ label, text, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--brand-green)]/20 bg-white/80 p-4 text-sm shadow-sm"
              >
                <Icon className="mb-3 size-5 text-[var(--brand-blue)]" />
                <p className="font-semibold text-[var(--brand-green-deep)]">
                  {label}
                </p>
                <p className="mt-2 leading-5 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 rounded-xl border border-[var(--brand-green)]/20 bg-white/70 p-4 shadow-sm sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-green)]/10 text-[var(--brand-green-deep)]">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--brand-green-deep)]">
                  Secure staff access
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Admin, manager, and staff sessions stay role-aware.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-gold)]/15 text-[var(--brand-gold-text)]">
                <BellRing className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--brand-green-deep)]">
                  Daily alerts
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Low stock and customer loan follow-ups stay visible.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="order-1 rounded-xl border border-border/80 bg-card/95 p-5 shadow-xl backdrop-blur sm:p-7 lg:order-2">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-[var(--brand-green)] text-white shadow-sm">
                <KeyRound className="size-5" />
              </div>
              <h2 className="text-2xl font-semibold text-[var(--brand-green-deep)]">
                Sign in
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use your staff or admin account to continue to the dashboard.
              </p>
            </div>
            <div className="hidden size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--brand-green)]/20 bg-white shadow-sm sm:flex">
              <Image
                src="/images/logo.webp"
                alt="BIRW logo"
                width={64}
                height={64}
                priority
                className="h-full w-full object-contain p-2"
              />
            </div>
          </div>

          {message ? (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {message}
            </div>
          ) : null}

          <form
            className="space-y-4"
            autoComplete="off"
            onSubmit={handleLogin}
          >
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Email or username
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pl-9"
                  placeholder="Email or username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="text"
                  autoComplete="off"
                  name="inventory-login-user"
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
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="off"
                  name="inventory-login-passcode"
                  required
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

            <Button
              className="h-11 w-full bg-[var(--brand-green)] font-semibold text-white hover:bg-[var(--brand-green-deep)]"
              disabled={isPending}
            >
              {isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-[var(--brand-green)]/20 bg-[var(--brand-green-soft)]/70 p-4">
            <p className="text-sm font-semibold text-[var(--brand-green-deep)]">
              First time opening BIRW Inventory?
            </p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Create the initial administrator account before staff sign in.
            </p>
            <Button
              asChild
              variant="secondary"
              className="mt-3 h-11 w-full border border-[var(--brand-gold)] bg-[var(--brand-gold)] font-semibold text-[var(--brand-green-deep)] hover:bg-[var(--brand-gold)]/90"
            >
              <Link href="/setup-admin">
                Get Started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
