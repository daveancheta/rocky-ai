"use client"

import Link from "next/link"
import { ChevronRight, Home, Monitor, Moon, Sun } from "lucide-react"
import { useEffect, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { useThemeStore, type Appearance } from "@/stores/theme-store"

export function AppShell({ children }: { children: ReactNode }) {
  const appearance = useThemeStore((state) => state.appearance)
  const setAppearance = useThemeStore((state) => state.setAppearance)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const applyTheme = () => {
      document.documentElement.classList.toggle(
        "dark",
        appearance === "dark" || (appearance === "system" && mediaQuery.matches),
      )
    }
    applyTheme()
    mediaQuery.addEventListener("change", applyTheme)
    return () => mediaQuery.removeEventListener("change", applyTheme)
  }, [appearance])

  const cycleAppearance = () => {
    const next: Appearance =
      appearance === "light" ? "dark" : appearance === "dark" ? "system" : "light"
    setAppearance(next)
  }
  const ThemeIcon = appearance === "dark" ? Moon : appearance === "system" ? Monitor : Sun

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Rocky home">
          <span>rocky<span className="brand-period">.</span></span>
        </Link>

        <div className="sidebar-workspace">
          <span className="sidebar-label">WORKSPACE</span>
          <nav className="sidebar-nav" aria-label="Main navigation">
            <Link href="/" aria-current="page" className="nav-link active">
              <Home size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>Home</span>
              <span className="nav-indicator" />
            </Link>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-actions flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="theme-control"
              onClick={cycleAppearance}
              aria-label={`Change appearance, currently ${appearance}`}
            >
              <ThemeIcon size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Appearance</span>
              <span className="theme-value">{appearance}</span>
              <ChevronRight className="theme-chevron" size={15} aria-hidden="true" />
            </Button>
            <Button type="button" variant="outline" className="sidebar-google-button">
              <svg aria-hidden="true" viewBox="0 0 48 48" width="18" height="18">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.91a11.04 11.04 0 0 1-4.79 7.24l7.72 5.99c4.5-4.15 7.14-10.27 7.14-17.7Z" />
                <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.89.93 7.58 2.56 10.78l7.97-6.19Z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.94-2.13 15.92-5.76l-7.72-5.99c-2.14 1.44-4.88 2.3-8.2 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
              </svg>
              <span>Continue with Google</span>
            </Button>
          </div>
        </div>
      </aside>

      <div className="mobile-header">
        <Link href="/" className="brand" aria-label="Rocky home">
          <span>rocky<span className="brand-period">.</span></span>
        </Link>
        <span className="mobile-status"><span className="status-dot" /> Demo mode</span>
      </div>
      <main className="main-content">{children}</main>
    </div>
  )
}
