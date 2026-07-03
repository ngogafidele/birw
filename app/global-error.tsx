"use client"

// Provides the root error boundary UI required by Next.js App Router.

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <main
          style={{
            alignItems: "center",
            background: "#f6faf6",
            color: "#102017",
            display: "flex",
            minHeight: "100vh",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #d3e3d7",
              borderRadius: "1.44rem",
              boxShadow: "0 1px 2px rgba(16, 32, 23, 0.08)",
              maxWidth: "28rem",
              padding: "1.5rem",
              width: "100%",
            }}
          >
            <p
              style={{
                color: "#55665b",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.2em",
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              BIRW Inventory
            </p>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                lineHeight: 1.2,
                margin: "0.75rem 0 0",
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                color: "#55665b",
                fontSize: "0.875rem",
                lineHeight: 1.5,
                margin: "0.5rem 0 0",
              }}
            >
              Refresh the workspace and try the action again.
            </p>
            <button
              type="button"
              style={{
                background: "#126a35",
                border: 0,
                borderRadius: "0.8rem",
                color: "#ffffff",
                fontSize: "0.875rem",
                fontWeight: 500,
                marginTop: "1.25rem",
                padding: "0.5rem 1rem",
              }}
              onClick={() => unstable_retry()}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}
