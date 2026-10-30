"use client"

import Link from "next/link"
import { ChevronRight, Clock3, Home, LogOut, Menu, Monitor, Moon, Sun, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { GoogleIcon } from "@/components/ui/google-icon"
import { BrandMark } from "@/components/brand-mark"
import { useThemeStore, type Appearance } from "@/stores/theme-store"
import { AuthStore } from "@/stores/auth-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function AppShell({ children }: { children: ReactNode }) {
  const [themeHydrated, setThemeHydrated] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const pathname = usePathname()
  const appearance = useThemeStore((state) => state.appearance)
  const setAppearance = useThemeStore((state) => state.setAppearance)
  const { signinWithGoogle, handleGetSession, signOut, auth, isLoading } = AuthStore()

  useEffect(() => {
    handleGetSession()
  }, [handleGetSession])

  useEffect(() => {
    let active = true
    void Promise.resolve(useThemeStore.persist.rehydrate()).catch(() => undefined).finally(() => {
      if (active) setThemeHydrated(true)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!themeHydrated) return
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
  }, [appearance, themeHydrated])

  const cycleAppearance = () => {
    const next: Appearance =
      appearance === "light" ? "dark" : appearance === "dark" ? "system" : "light"
    setAppearance(next)
  }
  const ThemeIcon = appearance === "dark" ? Moon : appearance === "system" ? Monitor : Sun
  const userInitials = auth?.name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || auth?.email?.charAt(0).toUpperCase() || "U"

  return (
    <div className="app-frame">
      <button type="button" className={`mobile-sidebar-backdrop${mobileSidebarOpen ? " mobile-open" : ""}`} aria-label="Close navigation menu" tabIndex={mobileSidebarOpen ? 0 : -1} onClick={() => setMobileSidebarOpen(false)} />
      <aside id="primary-sidebar" className={`sidebar${mobileSidebarOpen ? " mobile-open" : ""}`}>
        <Link href="/" className="brand" aria-label="Rocky home">
          <span>rocky<span className="brand-period">.</span></span>
        </Link>

        <div className="sidebar-workspace">
          <span className="sidebar-label">WORKSPACE</span>
          <nav className="sidebar-nav" aria-label="Main navigation">
            <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={`nav-link${pathname === "/" ? " active" : ""}`} onClick={() => setMobileSidebarOpen(false)}>
              <Home size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>Home</span>
              {pathname === "/" && <span className="nav-indicator" />}
            </Link>
            <Link href="/history" aria-current={pathname === "/history" ? "page" : undefined} className={`nav-link${pathname === "/history" ? " active" : ""}`} onClick={() => setMobileSidebarOpen(false)}>
              <Clock3 size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>Recent analyses</span>
              {pathname === "/history" && <span className="nav-indicator" />}
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
            {isLoading ? (
              <Card
                className="sidebar-profile-card gap-0 p-2.5 ring-1"
                role="status"
                aria-label="Checking your account"
                aria-busy="true"
              >
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="grid min-w-0 flex-1 gap-2">
                    <Skeleton className="h-3 w-24 max-w-full" />
                    <Skeleton className="h-2.5 w-32 max-w-full" />
                  </div>
                </div>
              </Card>
            ) : auth ? (
              <div className="grid gap-1.5">
                <Card className="sidebar-profile-card gap-2.5 p-2.5 ring-1" aria-label="Signed in profile">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="sidebar-profile-avatar size-9">
                      {auth.image && <AvatarImage src={auth.image} alt={auth.name || "Profile"} />}
                      <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="sidebar-profile-name truncate">{auth.name || "Rocky user"}</p>
                      <p className="sidebar-profile-email truncate">{auth.email}</p>
                    </div>
                  </div>
                </Card>
                <Button type="button" variant="ghost" className="sidebar-signout-button" onClick={signOut}>
                  <LogOut aria-hidden="true" />
                  <span>Sign out</span>
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="sidebar-google-button" onClick={signinWithGoogle}>
                <GoogleIcon />
                <span>Continue with Google</span>
              </Button>
            )}
          </div>
        </div>
      </aside>

      <div className="mobile-header">
        <Link href="/" className="brand" aria-label="Rocky home">
          <BrandMark size={30} />
          <span>rocky<span className="brand-period">.</span></span>
        </Link>
        <Button type="button" variant="ghost" size="icon" aria-label={mobileSidebarOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileSidebarOpen} aria-controls="primary-sidebar" onClick={() => setMobileSidebarOpen((open) => !open)}>
          {mobileSidebarOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </div>
      <main className="main-content">{children}</main>
    </div>
  )
}
