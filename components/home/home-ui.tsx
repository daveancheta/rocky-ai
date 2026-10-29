import Link from "next/link"
import { Play, ScanEye } from "lucide-react"
import { Card } from "@/components/ui/card"

export function HomeUI() {
  return (
    <section className="companion-experience" aria-label="ROCKY home">
      <header className="page-header home-header companion-header">
        <div>
          <span className="eyebrow">YOUR COMPANION</span>
          <h1>Welcome<span className="heading-period">.</span></h1>
          <p>A little space for whatever&apos;s on your mind.</p>
        </div>
      </header>

      <div className="companion-layout">
        <div className="companion-stage">
          <Card className="presence-panel presence-ready gap-0 ring-0" aria-label="ROCKY companion preview">
            <div className="presence-topline">
              <span className="eyebrow"><span className="status-dot" /> ROCKY IS HERE</span>
              <span className="presence-awareness-status presence-status-ready">
                <span className="presence-live-dot" aria-hidden="true" />
                Ready when you are
              </span>
            </div>

            <div className="presence-main">
              <div className="presence-orb" aria-hidden="true">
                <div className="orb-ring ring-one" />
                <div className="orb-ring ring-two" />
                <div className="orb-ring ring-three" />
                <div className="orb-sweep" />
                <div className="orb-core" />
              </div>
              <div className="presence-copy">
                <p className="presence-kicker">A little space to be</p>
                <h2>I&apos;m here with you.</h2>
                <p className="presence-state">Take a breath and make yourself at home.</p>
              </div>
            </div>

            <div className="presence-session-status" aria-hidden="true" />
            <div className="companion-session-button" aria-hidden="true">
              <Play size={17} />
              Start companion
            </div>
            <p className="presence-footnote">A quiet space, ready whenever you are.</p>
          </Card>
        </div>
        <Link
          href="/visual-intelligence"
          className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground no-underline shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <ScanEye size={16} aria-hidden="true" />
          Explore Visual Intelligence
        </Link>
      </div>
    </section>
  )
}
