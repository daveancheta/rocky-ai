"use client"

import Link from "next/link"
import { useEffect, type ReactNode } from "react"

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    localStorage.removeItem("rocky-preferences")
  }, [])

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Rocky home">
          <span>rocky<span className="brand-period">.</span></span>
        </Link>
        <span className="sidebar-label">YOUR SPACE</span>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <Link href="/" aria-current="page" className="nav-link active">
            <span>Home</span>
            <span className="nav-indicator" />
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="status-dot" />
            <span>Here for you, always</span>
          </div>
          <span className="version-label">A little space for you</span>
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
