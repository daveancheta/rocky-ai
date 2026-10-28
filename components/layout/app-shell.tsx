"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { Home, Moon, Settings, Sun, Brain } from "lucide-react"
import { useSettingsStore } from "@/stores/settings-store"
import type { Appearance } from "@/stores/settings-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RockyLogoMark } from "@/components/layout/rocky-logo"

const navigation = [
  { href: "/", label: "Home", icon: Home },
  { href: "/memories", label: "Memories", icon: Brain },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const appearance = useSettingsStore((state) => state.appearance)
  const setAppearance = useSettingsStore((state) => state.setAppearance)

  useEffect(() => {
    void useSettingsStore.persist.rehydrate()
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const updateTheme = () => {
      document.documentElement.classList.toggle(
        "dark",
        appearance === "dark" || (appearance === "system" && mediaQuery.matches),
      )
    }
    updateTheme()
    mediaQuery.addEventListener("change", updateTheme)
    return () => mediaQuery.removeEventListener("change", updateTheme)
  }, [appearance])

  const cycleAppearance = () => {
    const next: Appearance =
      appearance === "light" ? "dark" : appearance === "dark" ? "system" : "light"
    setAppearance(next)
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Rocky home">
          <RockyLogoMark className="brand-mark" />
          <span>rocky<span className="brand-period">.</span></span>
        </Link>
        <span className="sidebar-label">YOUR SPACE</span>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("nav-link", active && "active")}
              >
                <Icon size={18} strokeWidth={1.7} />
                <span>{label}</span>
                {active && <span className="nav-indicator" />}
              </Link>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <Button
            variant="outline"
            className="theme-control"
            onClick={cycleAppearance}
            aria-label={`Change appearance, currently ${appearance}`}
          >
            {appearance === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            <span>{appearance === "system" ? "System theme" : `${appearance[0].toUpperCase()}${appearance.slice(1)} theme`}</span>
            <span className="theme-switch">↗</span>
          </Button>
          <div className="sidebar-note">
            <span className="status-dot" />
            <span>Here for you, always</span>
          </div>
          <span className="version-label">A little space for you</span>
        </div>
      </aside>
      <div className="mobile-header">
        <Link href="/" className="brand" aria-label="Rocky home">
          <RockyLogoMark className="brand-mark" />
          <span>rocky<span className="brand-period">.</span></span>
        </Link>
        <span className="mobile-status"><span className="status-dot" /> Demo mode</span>
      </div>
      <main className="main-content">{children}</main>
      <nav className="mobile-nav" aria-label="Main navigation">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("mobile-nav-link", active && "active")}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
