/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { BrandWordmark } from "./components/brand-wordmark";
import { MobileNavigation } from "./components/mobile-navigation";
import {
  WaitlistSignupFlow,
  WaitlistSignupProvider,
} from "./components/waitlist-signup-flow";
import { isFoundingContributorSalesPageEnabled } from "@/lib/contributor-sales-page.server";
import { INSTAGRAM_URL } from "@/lib/site";

const content = {
  navigation: [
    { label: "Product", href: "#product" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Research", href: "#research" },
  ],
  insights: [
    ["Baseline", "What is normal for you during comparable periods."],
    ["Recovery", "How quickly you return toward your usual pattern."],
    ["Response", "How your cardiovascular system changes around meaningful events."],
    ["Confidence", "What was measured reliably, and what was not."],
  ],
  principles: [
    ["Personal, not generic", "Interpreted against your own baseline and daily context."],
    ["Context before judgment", "A temporary rise is not automatically a concern."],
    ["Patterns over moments", "Repeated associations matter more than any single event."],
    ["Honest gaps", "When a signal is unreliable, Frame does not invent an answer."],
  ],
  researchStandards: [
    ["Signal integrity", "Report confidence and coverage alongside every measurement."],
    ["Human validation", "Evaluate comfort, motion tolerance, and repeatability in real use."],
    ["Responsible claims", "Only communicate conclusions supported by evidence."],
  ],
} as const;

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default async function Home() {
  const showLocalContributorAreas =
    await isFoundingContributorSalesPageEnabled();
  const mobileNavigation = showLocalContributorAreas
    ? [
        ...content.navigation,
        { label: "Contributors", href: "/founding-contributors" },
      ]
    : content.navigation;

  return (
    <WaitlistSignupProvider>
    <main>
      <header className="nav-shell">
        <nav className="nav container" aria-label="Primary navigation">
          <Link className="wordmark" href="/" aria-label="Frame home">
            <BrandWordmark priority />
          </Link>
          <div className="nav-links">
            {content.navigation.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
            {showLocalContributorAreas ? (
              <a href="/founding-contributors">Contributors</a>
            ) : null}
          </div>
          <a className="nav-cta" href="#homepage-hero-waitlist">
            Join the waitlist
          </a>
          <MobileNavigation items={mobileNavigation} />
        </nav>
      </header>

      <section className="hero hero--email-first" id="top">
        <div className="hero-grid container">
          <div className="hero-copy">
            <p className="eyebrow hero-email-first__eyebrow">
              MEASURE YOUR BLOOD PRESSURE CONTINUOUSLY
            </p>
            <h1>See how your cardiovascular system responds to daily life.</h1>
            <p className="hero-intro">
              Frame is developing a non-invasive upper-arm wearable that reveals
              how blood pressure changes throughout daily life.
            </p>
            <WaitlistSignupFlow placement="homepage_hero" compact />
          </div>
          <figure className="hero-visuals">
            <div className="hero-lifestyle">
              <img
                src="/frame-hero-man-transparent-v3-720w.webp"
                srcSet="/frame-hero-man-transparent-v3-480w.webp 480w, /frame-hero-man-transparent-v3-720w.webp 720w, /frame-hero-man-transparent-v3-960w.webp 960w"
                alt="Man wearing the Frame wearable concept on his upper arm"
                width={1089}
                height={1444}
                sizes="(max-width: 680px) 100vw, (max-width: 980px) 56vw, 34vw"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
            <figcaption>Product concept. Final design in development.</figcaption>
          </figure>
        </div>
      </section>

      <section className="context-section section" id="product">
        <div className="container context-container">
          <div className="context-intro">
            <p className="eyebrow">Why context matters</p>
            <h2>A single reading cannot show a pattern.</h2>
            <p>
              Blood pressure changes with sleep, movement, stress, exercise,
              food, posture, and recovery. Most people only see an occasional
              snapshot. Frame aims to help make sense of what happens in
              between, without treating every temporary rise as harmful.
            </p>
          </div>
          <div className="context-content">
            <div className="insight-list" aria-label="Baseline and recovery">
              {content.insights.slice(0, 2).map(([title, description], index) => (
                <article key={title}>
                  <span>0{index + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
            <figure className="product-concept-showcase">
              <div className="product-concept-showcase__media">
                <img
                  src="/frame-product-concept-realistic-v3-transparent-720w.webp"
                  srcSet="/frame-product-concept-realistic-v3-transparent-480w.webp 480w, /frame-product-concept-realistic-v3-transparent-720w.webp 720w, /frame-product-concept-realistic-v3-transparent-960w.webp 960w"
                  alt="Refined Frame upper-arm wearable concept with an adjustable charcoal knit band, burgundy clasp, and integrated ultrasound sensor"
                  width={1254}
                  height={1254}
                  sizes="(max-width: 680px) 84vw, (max-width: 980px) 480px, 42vw"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption>Product concept · final design in development</figcaption>
            </figure>
            <div className="insight-list" aria-label="Response and confidence">
              {content.insights.slice(2).map(([title, description], index) => (
                <article key={title}>
                  <span>0{index + 3}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="method-section section" id="how-it-works">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2>Ultrasound, made wearable.</h2>
            <p>
              Ultrasound can look beneath the surface and observe the artery
              itself. Frame is exploring how to make that signal dependable,
              comfortable, and useful over time.
            </p>
          </div>
          <div className="method-layout">
            <figure className="wide-image">
              <div className="wide-image-media image-frame">
                <img
                  src="/frame-sensing-concept-realistic-v3-transparent-960w.webp"
                  srcSet="/frame-sensing-concept-realistic-v3-transparent-640w.webp 640w, /frame-sensing-concept-realistic-v3-transparent-960w.webp 960w, /frame-sensing-concept-realistic-v3-transparent-1280w.webp 1280w"
                  alt="Exploded sensing concept showing the refined Frame ultrasound contact module above skin, tissue, and an artery"
                  className="cover-image"
                  width={1448}
                  height={1086}
                  sizes="(max-width: 680px) calc(100vw - 72px), (max-width: 980px) 40vw, 480px"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption>
                Simplified sensing concept · anatomy and final sensor
                configuration are illustrative
              </figcaption>
            </figure>
            <ol className="method-steps">
              <li>
                <span>01</span>
                <div>
                  <h3>Observe</h3>
                  <p>A specialised sensor observes the artery beneath the skin.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Interpret</h3>
                  <p>Arterial features are analysed using a personalised model.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Add context</h3>
                  <p>
                    Motion, contact, temperature, sleep, and activity add
                    meaning.
                  </p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <h3>Show what is trusted</h3>
                  <p>Uncertain or interrupted periods remain clearly marked.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="software-section section">
        <div className="container software-grid">
          <figure className="software-image image-frame">
            <img
              src="/frame-app-studio-v5-640w.webp"
              srcSet="/frame-app-studio-v5-480w.webp 480w, /frame-app-studio-v5-640w.webp 640w, /frame-app-studio-v5-896w.webp 896w"
              alt="Refined Frame companion app in an accurately proportioned iPhone 17 mockup, showing 82 percent reliable overnight coverage, a motion interruption, and a late meal timing pattern"
              className="cover-image"
              width={897}
              height={1752}
              sizes="(max-width: 980px) calc(100vw - 64px), 58vw"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <div className="software-copy">
            <p className="eyebrow">The experience</p>
            <h2>From measurements to personal experiments.</h2>
            <p>
              Frame is designed to explain patterns relative to your baseline,
              show how long a response lasts, and make confidence part of every
              result.
            </p>
            <blockquote>
              <span>Pattern to explore</span>
              “On three similar nights, later meals were associated with a
              higher overnight pattern.”
              <small>An association, not a conclusion.</small>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="principles-section section" id="research">
        <div className="container principles-grid">
          <div className="principles-copy">
            <p className="eyebrow">Product principles</p>
            <h2>
              Continuous monitoring should create context, not continuous
              conclusions.
            </h2>
            <div className="principle-list">
              {content.principles.map(([title, description]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
          <aside className="research-panel">
            <span className="status-label">Research approach</span>
            <h3>Evidence before claims.</h3>
            <p>
              Frame is evaluating signal quality, wearability, and measurement
              accuracy before making broader claims.
            </p>
            <div className="research-standards" aria-label="Frame research standards">
              {content.researchStandards.map(([title, description]) => (
                <article key={title}>
                  <h4>{title}</h4>
                  <p>{description}</p>
                </article>
              ))}
            </div>
            <a
              className="text-link"
              href="/contact?topic=research"
            >
              Research and engineering inquiries <Arrow />
            </a>
          </aside>
        </div>
      </section>

      {showLocalContributorAreas ? (
        <section className="home-contributor-section">
          <div className="container home-contributor-grid">
            <div>
              <p className="eyebrow">Founding Contributors</p>
              <h2>Join the work, not a product preorder.</h2>
            </div>
            <div>
              <p>
                A one-time $99 membership for 12 months of private development
                updates, founder Q&amp;A, briefings, advisory votes, and optional
                research opportunities. No device is included or guaranteed.
              </p>
              <a className="button button--dark" href="/founding-contributors?source=homepage">
                Explore the membership
              </a>
            </div>
          </div>
        </section>
      ) : null}

      <section className="final-cta" id="early-access">
        <div className="container final-grid">
          <div className="final-cta__copy">
            <p className="eyebrow">Early access</p>
            <h2>Help shape a new way to understand cardiovascular health.</h2>
          </div>
          <div className="final-cta__form final-cta__action">
            <WaitlistSignupFlow placement="homepage_final" tone="light" />
            <a
              className="collaboration-link"
              href="/contact?topic=research"
            >
              Interested in research or engineering collaboration? <Arrow />
            </a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-top">
          <Link
            className="wordmark wordmark--footer"
            href="/"
            aria-label="Frame home"
          >
            <BrandWordmark variant="light" />
          </Link>
          <div className="footer-links">
            <a href="#product">Product</a>
            <a href="#research">Research</a>
            {showLocalContributorAreas ? (
              <a href="/founding-contributors">Founding Contributors</a>
            ) : null}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Frame on Instagram (opens in a new tab)"
            >
              Instagram <Arrow />
            </a>
            <a href="/privacy">Privacy</a>
            <a href="/contact">Contact</a>
          </div>
        </div>
        <div className="container footer-bottom">
          <p>
            Frame is under development and is not currently available for sale.
            Product concepts and interfaces shown are illustrative. Frame is not
            intended to diagnose or treat any medical condition.
          </p>
          <p>© {new Date().getFullYear()} Frame Health Technologies</p>
        </div>
      </footer>
    </main>
    </WaitlistSignupProvider>
  );
}
