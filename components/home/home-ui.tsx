import { VisualIntelligenceForm } from "@/components/visual-intelligence/visual-intelligence-form"

export function HomeUI() {
  return (
    <section aria-labelledby="home-title">
      <header className="page-header home-header">
        <div>
          <span className="eyebrow">VISUAL INTELLIGENCE</span>
          <h1 id="home-title">What are you looking at<span className="heading-period">?</span></h1>
          <p>Share a photo and Rocky will help you understand what it shows.</p>
        </div>
      </header>
      <VisualIntelligenceForm />
    </section>
  )
}
