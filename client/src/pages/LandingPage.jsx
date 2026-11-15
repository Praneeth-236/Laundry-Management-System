import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-nav"><Link className="brand" to="/"><span className="brand-mark">w</span><span>Washday</span></Link><div className="landing-actions"><Link className="text-link" to="/login">Sign in</Link><Link className="button button-primary button-small" to="/signup">Create account <span>↗</span></Link></div></header>
      <main>
        <section className="hero-wrap">
          <div className="hero-copy"><span className="eyebrow"><span className="eyebrow-dot" /> MADE FOR HOSTEL & SHARED LIVING</span><h1>Laundry, without<br />the <em>guesswork.</em></h1><p>Keep track of what you own, what is in the wash, and what still needs to come back. A little more calm in your everyday routine.</p><div className="hero-actions"><Link className="button button-primary" to="/signup">Start your laundry space <span>↗</span></Link><span className="micro-copy">Free to use · Your data stays yours</span></div></div>
          <div className="hero-art" aria-label="Illustration of folded laundry">
            <div className="sun-disc" /><div className="laundry-shelf shelf-one"><span className="fold fold-cream" /><span className="fold fold-blue" /><span className="fold fold-sage" /></div><div className="laundry-shelf shelf-two"><span className="fold fold-coral" /><span className="fold fold-white" /><span className="fold fold-mustard" /></div><div className="wash-note"><span className="note-icon">✓</span><span><strong>Fresh start</strong><small>Your week, in order</small></span></div><div className="decor-star star-one">✳</div><div className="decor-star star-two">✳</div>
          </div>
        </section>
        <section className="benefits"><div className="benefit"><span className="benefit-icon mint">01</span><div><h2>Know what you have</h2><p>A digital closet for the clothes that make up your everyday.</p></div></div><div className="benefit"><span className="benefit-icon peach">02</span><div><h2>Know what's in the wash</h2><p>Track each cycle and see what has made it back.</p></div></div><div className="benefit"><span className="benefit-icon lilac">03</span><div><h2>Keep your own rhythm</h2><p>Set laundry days that fit hostel or shared-home life.</p></div></div></section>
      </main>
      <footer className="landing-footer"><span>Washday</span><span>Built for everyday laundry in shared living.</span></footer>
    </div>
  );
}
