import { VisualIntelligenceForm } from "@/components/visual-intelligence/visual-intelligence-form"

export default function VisualIntelligencePage() {
  return (
    <div className="page">
      <section aria-labelledby="visual-intelligence-title">
        <header className="page-header">
          <div>
            <span className="eyebrow">VISUAL INTELLIGENCE</span>
            <h1 id="visual-intelligence-title">What are you looking at<span className="heading-period">?</span></h1>
            <p>Share a photo and Rocky will help you understand what it shows.</p>
          </div>
        </header>
        <VisualIntelligenceForm />
      </section>
    </div>
  )
}
