"use client";

import { FormEvent, useState } from "react";

const COLLABORATION_EMAIL = "research@frame.health";

const content = {
  navigation: [
    { label: "Product", href: "#product" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Principles", href: "#principles" },
    { label: "Research", href: "#research" },
    { label: "Early access", href: "#early-access" },
  ],
  insights: [
    {
      number: "01",
      title: "Baseline",
      description:
        "Learn what is normal for you during comparable periods.",
    },
    {
      number: "02",
      title: "Response",
      description:
        "See how your cardiovascular system changes around meaningful events.",
    },
    {
      number: "03",
      title: "Recovery",
      description:
        "Understand how quickly you return toward your usual pattern.",
    },
    {
      number: "04",
      title: "Confidence",
      description:
        "Know what was measured reliably—and where Frame does not have enough information.",
    },
  ],
  useCases: [
    {
      label: "Sleep",
      index: "01",
      description:
        "See how your cardiovascular pattern changes overnight and on waking.",
    },
    {
      label: "Exercise",
      index: "02",
      description:
        "Compare your response before training with the way you recover afterwards.",
    },
    {
      label: "Stress & workload",
      index: "03",
      description:
        "Explore whether demanding periods repeatedly coincide with a different resting pattern.",
    },
    {
      label: "Habits",
      index: "04",
      description:
        "Test how sleep timing, alcohol, meals, and recovery routines relate to your personal baseline.",
    },
  ],
  principles: [
    {
      title: "Personal, not generic",
      description:
        "Your cardiovascular patterns should be interpreted relative to your own baseline and context.",
    },
    {
      title: "Context before judgement",
      description:
        "A temporary rise is not automatically bad. What you were doing—and how you recovered—matters.",
    },
    {
      title: "Patterns over moments",
      description:
        "The aim is to learn from repeated responses, not overreact to one isolated reading.",
    },
    {
      title: "Confidence is part of the result",
      description:
        "Frame should show where data is strong, limited, or simply not reliable enough to interpret.",
    },
    {
      title: "Honest gaps",
      description:
        "An unavailable reading is more useful than fabricated precision. Uncertainty stays visible.",
    },
    {
      title: "Passive and non-invasive",
      description:
        "No needles, no skin penetration, and no constant screen demanding your attention.",
    },
  ],
  stages: [
    "Bench validation",
    "Human feasibility testing",
    "Sleep and rest validation",
    "Expanded daily-life coverage",
    "Consumer product",
  ],
  contact: {
    general: "hello@frame.health",
    collaboration: COLLABORATION_EMAIL,
  },
} as const;

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

function SectionHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <header className="section-header">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {intro ? <p className="section-intro">{intro}</p> : null}
    </header>
  );
}

function SignalMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={compact ? "signal-mark signal-mark--compact" : "signal-mark"}
      viewBox="0 0 80 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 15h13l5-9 7 16 8-12 7 5h10l5-7 7 12 6-5h10"
        pathLength="1"
      />
    </svg>
  );
}

function HeroProduct() {
  return (
    <div className="hero-product" aria-label="Concept illustration of Frame worn on the inner upper arm">
      <div className="hero-orbit hero-orbit--one" />
      <div className="hero-orbit hero-orbit--two" />
      <div className="arm">
        <div className="artery-line" />
        <div className="band band--back" />
        <div className="band band--front">
          <div className="sensor-pod">
            <span className="sensor-inset" />
          </div>
          <div className="contact-wave contact-wave--one" />
          <div className="contact-wave contact-wave--two" />
          <div className="contact-wave contact-wave--three" />
        </div>
      </div>
      <div className="product-note product-note--sensor">
        <span />
        Precision sensing pod
      </div>
      <div className="product-note product-note--location">
        <span />
        Inner upper arm
      </div>
      <p className="concept-label">Product concept · not final industrial design</p>
    </div>
  );
}

function PatternTimeline() {
  return (
    <div className="pattern-comparison" aria-label="Comparison between isolated readings and contextual measurement periods">
      <div className="comparison-row">
        <div>
          <span className="comparison-kicker">Occasional cuff</span>
          <strong>One isolated reading</strong>
        </div>
        <div className="sparse-timeline" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="comparison-row comparison-row--frame">
        <div>
          <span className="comparison-kicker">Frame’s direction</span>
          <strong>Baseline → Response → Recovery</strong>
        </div>
        <div className="dense-timeline" aria-hidden="true">
          <span className="timeline-baseline" />
          <span className="timeline-response" />
          <span className="timeline-recovery" />
          <i className="timeline-gap" />
        </div>
        <div className="timeline-key">
          <span><i className="key-dot key-dot--high" /> Reliable</span>
          <span><i className="key-dot key-dot--partial" /> Partial</span>
          <span><i className="key-dot key-dot--gap" /> No reading</span>
        </div>
      </div>
    </div>
  );
}

function ProductDiagram() {
  return (
    <div className="product-diagram">
      <div className="band-angle band-angle--main">
        <div className="band-angle__strap" />
        <div className="band-angle__pod"><span /></div>
        <div className="band-angle__balance" />
      </div>
      <div className="band-angle band-angle--side" aria-hidden="true">
        <div className="band-angle__strap" />
        <div className="band-angle__pod"><span /></div>
        <div className="band-angle__balance" />
      </div>
      <div className="diagram-label diagram-label--pod"><i />Ultrasound sensing pod</div>
      <div className="diagram-label diagram-label--contact"><i />Stable skin interface</div>
      <div className="diagram-label diagram-label--motion"><i />Motion &amp; contact sensing</div>
      <div className="diagram-label diagram-label--battery"><i />Balanced electronics</div>
      <div className="diagram-label diagram-label--band"><i />Soft upper-arm band</div>
      <p className="concept-label">Exploratory product architecture</p>
    </div>
  );
}

function CrossSection() {
  return (
    <div className="cross-section-wrap">
      <svg
        className="cross-section"
        viewBox="0 0 620 420"
        role="img"
        aria-labelledby="cross-section-title cross-section-desc"
      >
        <title id="cross-section-title">Simplified ultrasound arm cross-section</title>
        <desc id="cross-section-desc">
          A sensor pod sends ultrasound waves through skin and soft tissue toward the brachial artery.
        </desc>
        <defs>
          <linearGradient id="skinLayer" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#d9a07f" />
            <stop offset="1" stopColor="#e6b392" />
          </linearGradient>
          <linearGradient id="tissueLayer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e8c8ae" />
            <stop offset="1" stopColor="#d8b69e" />
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="12" stdDeviation="12" floodOpacity=".12" />
          </filter>
        </defs>
        <rect x="174" y="28" width="272" height="72" rx="28" fill="#383733" filter="url(#softShadow)" />
        <rect x="210" y="43" width="200" height="42" rx="17" fill="#4d4b46" />
        <circle cx="310" cy="64" r="7" fill="#b9b5a9" />
        <text x="470" y="71" className="svg-label">Sensor pod</text>
        <path d="M446 63h15" className="svg-rule" />

        <rect x="58" y="130" width="504" height="34" rx="17" fill="url(#skinLayer)" />
        <path d="M58 170c62-10 118 12 180 1s120-8 172 1 102-3 152-1v133H58z" fill="url(#tissueLayer)" />
        <path d="M58 304c63-9 116 10 178 1s116-8 174 0 101-3 152 0v68H58z" fill="#d3a88e" />
        <text x="76" y="151" className="svg-layer-label">Skin</text>
        <text x="76" y="207" className="svg-layer-label">Soft tissue</text>

        <ellipse cx="310" cy="292" rx="70" ry="43" fill="#74323b" />
        <ellipse cx="310" cy="292" rx="48" ry="25" fill="#c4777e" />
        <text x="398" y="297" className="svg-label">Brachial artery</text>
        <path d="M379 292h11" className="svg-rule" />

        <path d="M260 106c-9 45-7 93 19 144" className="ultrasound-line ultrasound-line--one" />
        <path d="M310 106v139" className="ultrasound-line ultrasound-line--two" />
        <path d="M360 106c9 45 7 93-19 144" className="ultrasound-line ultrasound-line--three" />
        <path d="M281 246c8-12 17-19 29-19s22 7 31 19" className="return-wave" />

        <path d="M406 351h18l9-14 11 28 12-18 9 5h13" className="arterial-wave" />
        <text x="406" y="386" className="svg-layer-label">Arterial waveform</text>
      </svg>
      <p>Elegant anatomy, simplified. The final sensing configuration and calibration approach remain under development.</p>
    </div>
  );
}

function SoftwareMockup() {
  return (
    <div className="software-stage">
      <div className="app-window">
        <div className="app-topbar">
          <div className="app-brand"><span>F</span> Frame</div>
          <div className="app-date">Today · 07:42</div>
        </div>
        <div className="app-body">
          <div className="app-summary">
            <div>
              <p className="mini-label">Last night</p>
              <h3>Close to your<br />14-day baseline</h3>
            </div>
            <div className="coverage-ring">
              <span>82%</span>
              <small>reliable<br />coverage</small>
            </div>
          </div>
          <div className="app-timeline-card">
            <div className="timeline-card-head">
              <span>Overnight pattern</span>
              <span className="confidence-tag"><i /> High confidence</span>
            </div>
            <svg viewBox="0 0 620 155" role="img" aria-label="Illustrative overnight cardiovascular pattern">
              <path d="M0 108C40 98 58 112 92 91s67-15 100-2 58-4 95-24 61-4 92 16 57 17 87-3 63-35 86-16 41 17 68 3" className="chart-area" />
              <path d="M0 108C40 98 58 112 92 91s67-15 100-2 58-4 95-24 61-4 92 16 57 17 87-3 63-35 86-16 41 17 68 3" className="chart-line" />
              <path d="M0 104h620" className="chart-baseline" />
              <rect x="326" y="18" width="78" height="120" className="chart-gap" />
            </svg>
            <div className="chart-labels"><span>22:00</span><span>02:10—02:42<br />Movement</span><span>06:30</span></div>
            <div className="app-legend">
              <span><i className="key-dot key-dot--high" /> Reliable</span>
              <span><i className="key-dot key-dot--partial" /> Partial</span>
              <span><i className="key-dot key-dot--gap" /> No reliable measurement</span>
            </div>
          </div>
          <div className="app-insights">
            <article>
              <p className="mini-label">Recovery</p>
              <strong>Took longer than usual after yesterday’s training.</strong>
              <p>Worth comparing with your next similar session.</p>
            </article>
            <article>
              <p className="mini-label">Data quality</p>
              <strong>Movement interrupted part of the night.</strong>
              <p>Frame left this period unmeasured.</p>
            </article>
          </div>
        </div>
      </div>
      <article className="experiment-card">
        <div className="experiment-icon"><SignalMark compact /></div>
        <p className="mini-label">Pattern to explore</p>
        <h3>Late meal timing</h3>
        <p>
          On three similar nights, later meals were associated with a higher
          overnight pattern. This is an association, not a conclusion.
        </p>
        <div className="experiment-actions">
          <button type="button">Create an experiment</button>
          <button type="button" className="text-button">View similar nights <ArrowIcon /></button>
        </div>
      </article>
    </div>
  );
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!validEmail) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    // Connect a real waitlist API or database integration here.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="form-success" role="status" aria-live="polite">
        <span aria-hidden="true">✓</span>
        <div>
          <strong>You’re on the list.</strong>
          <p>We’ll share thoughtful updates as the research develops.</p>
        </div>
        <button type="button" onClick={() => { setSubmitted(false); setEmail(""); }}>
          Add another email
        </button>
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor="waitlist-email">Email address</label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={error ? "email-error" : undefined}
          aria-invalid={Boolean(error)}
        />
        {error ? <p className="form-error" id="email-error">{error}</p> : null}
      </div>
      <button className="button button--light" type="submit">
        Join early access <ArrowIcon />
      </button>
    </form>
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-nav-wrap">
        <nav className="site-nav container" aria-label="Primary navigation">
          <a className="wordmark" href="#top" aria-label="Frame home">Frame<span>.</span></a>
          <div className="nav-links">
            {content.navigation.slice(0, 4).map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </div>
          <a className="nav-cta" href="#early-access">Join early access <ArrowIcon /></a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid container">
          <div className="hero-copy">
            <div className="status-line">
              <p className="eyebrow">Blood pressure, in context.</p>
              <span className="status-pill"><i /> Currently in development</span>
            </div>
            <h1>See how your cardiovascular system responds to <em>daily life.</em></h1>
            <p className="hero-intro">
              Frame is developing a non-invasive upper-arm wearable that uses
              ultrasound to track blood-pressure patterns through sleep, rest,
              and recovery—then turns them into clear, personal insight.
            </p>
            <div className="hero-actions">
              <a className="button button--primary" href="#early-access">Join early access <ArrowIcon /></a>
              <a className="button button--text" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
            </div>
            <ul className="attribute-list" aria-label="Product attributes">
              <li>Non-invasive</li>
              <li>Ultrasound-based</li>
              <li>Screenless</li>
            </ul>
          </div>
          <HeroProduct />
        </div>
        <div className="hero-footer container">
          <span>Cardiovascular-response wearable</span>
          <SignalMark />
          <span>Designed for passive observation</span>
        </div>
      </section>

      <section className="problem-section section" id="product">
        <div className="container">
          <div className="split-heading">
            <SectionHeader eyebrow="The missing context" title="A single reading cannot show a pattern." />
            <p>
              Blood pressure changes throughout the day. Sleep, movement, stress,
              exercise, food, alcohol, posture, and recovery can all form part of
              the picture. Yet most people only see an occasional snapshot.
            </p>
          </div>
          <PatternTimeline />
        </div>
      </section>

      <section className="insight-section section">
        <div className="container">
          <SectionHeader
            eyebrow="The core insight"
            title="Understand more than the number."
            intro="Frame is designed around four ideas that keep cardiovascular data personal, useful, and honest."
          />
          <div className="insight-grid">
            {content.insights.map((item) => (
              <article className="insight-card" key={item.title}>
                <span>{item.number}</span>
                <div className="insight-icon" aria-hidden="true">
                  {item.title === "Baseline" && <><i /><i /><i /></>}
                  {item.title === "Response" && <SignalMark compact />}
                  {item.title === "Recovery" && <div className="recovery-ring"><i /></div>}
                  {item.title === "Confidence" && <div className="confidence-bars"><i /><i /><i /></div>}
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="hardware-section section">
        <div className="container hardware-grid">
          <div className="hardware-copy">
            <SectionHeader
              eyebrow="The product"
              title="A screenless wearable built around the artery."
            />
            <p>
              Frame is being designed to sit over the brachial artery on the
              inner upper arm. A precision sensing module observes arterial
              behaviour while supporting sensors monitor movement, contact, and
              signal quality.
            </p>
            <div className="pull-quote">
              <span>Designed to feel</span>
              <strong>Passive in use.<br />Precise in purpose.</strong>
            </div>
            <p className="fine-print">
              The exact coupling material, calibration approach, and final
              industrial design are still being tested.
            </p>
          </div>
          <ProductDiagram />
        </div>
      </section>

      <section className="how-section section" id="how-it-works">
        <div className="container">
          <div className="how-heading">
            <SectionHeader
              eyebrow="How it works"
              title="Ultrasound, made wearable."
              intro="Ultrasound can look beneath the surface and observe the artery itself. Frame is exploring how to make that signal dependable, comfortable, and useful over time."
            />
          </div>
          <div className="how-grid">
            <ol className="steps-list">
              {[
                ["Observe", "A specialised sensor uses ultrasound to observe the artery beneath the skin."],
                ["Interpret", "Arterial movement and waveform features are analysed using a personalised model and an initial reference calibration."],
                ["Add context", "Motion, contact, temperature, sleep, activity, and user context help explain the measurement."],
                ["Show what is trusted", "Frame surfaces reliable patterns and clearly marks incomplete or uncertain periods."],
              ].map(([title, description], index) => (
                <li key={title}>
                  <span>0{index + 1}</span>
                  <div><h3>{title}</h3><p>{description}</p></div>
                </li>
              ))}
            </ol>
            <CrossSection />
          </div>
        </div>
      </section>

      <section className="software-section section">
        <div className="container">
          <div className="split-heading split-heading--software">
            <SectionHeader eyebrow="The software experience" title="From measurements to personal experiments." />
            <p>
              Measure → explain → test → improve. Frame aims to turn dense
              measurement windows into calm, confidence-aware guidance you can
              investigate over repeated days.
            </p>
          </div>
          <SoftwareMockup />
        </div>
      </section>

      <section className="use-cases-section section">
        <div className="container">
          <div className="use-case-heading">
            <SectionHeader eyebrow="Daily life" title="Learn from the moments between checkups." />
            <div className="priority-note">
              <i />
              <p><strong>Early focus</strong> Sleep, rest, recovery, and other low-motion periods where a dependable signal is most achievable.</p>
            </div>
          </div>
          <div className="use-case-grid">
            {content.useCases.map((item) => (
              <article className="use-case-card" key={item.label}>
                <span>{item.index}</span>
                <h3>{item.label}</h3>
                <p>{item.description}</p>
                <i aria-hidden="true">↗</i>
              </article>
            ))}
          </div>
          <div className="questions-strip">
            <p>Questions worth exploring</p>
            <div>
              <span>How quickly did I recover after training?</span>
              <span>Do late meals repeatedly coincide with a different overnight pattern?</span>
              <span>Which periods were measured reliably?</span>
            </div>
          </div>
        </div>
      </section>

      <section className="principles-section section" id="principles">
        <div className="container">
          <div className="principles-title">
            <p className="eyebrow">Product principles</p>
            <h2>Continuous monitoring does not mean <em>continuous guessing.</em></h2>
            <p>
              Frame should prefer an honest gap over a fabricated number—and a
              repeated pattern over a premature conclusion.
            </p>
          </div>
          <div className="principles-grid">
            {content.principles.map((item, index) => (
              <article key={item.title}>
                <span>0{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="research-section section" id="research">
        <div className="container">
          <div className="research-grid">
            <div className="research-copy">
              <SectionHeader
                eyebrow="Research-stage technology"
                title="Building the evidence before making the promise."
              />
              <p>
                Wearable ultrasound blood-pressure monitoring remains a
                difficult technical problem. Frame is currently testing sensing
                location, long-duration contact, calibration, motion tolerance,
                comfort, and measurement accuracy.
              </p>
              <a className="button button--outline" href={`mailto:${content.contact.collaboration}?subject=Working%20on%20Frame`}>
                Work on Frame <ArrowIcon />
              </a>
              <p className="research-note">
                We are interested in hearing from researchers and engineers
                working in ultrasound, cardiovascular sensing, signal
                processing, flexible electronics, and wearable hardware.
              </p>
            </div>
            <ol className="development-track">
              {content.stages.map((stage, index) => (
                <li key={stage} className={index === 0 ? "active" : ""}>
                  <span>{index + 1}</span>
                  <div><strong>{stage}</strong>{index === 0 ? <small>Current focus</small> : null}</div>
                </li>
              ))}
            </ol>
          </div>
          <div className="research-questions">
            <span>What we’re validating</span>
            <p>Signal stability across bodies</p>
            <p>Comfortable long-duration contact</p>
            <p>Calibration and motion tolerance</p>
            <p>Battery, heat, and measurement density</p>
          </div>
        </div>
      </section>

      <section className="final-cta" id="early-access">
        <div className="container final-cta-grid">
          <div>
            <p className="eyebrow">Join the research journey</p>
            <h2>Help shape a new way to understand cardiovascular health.</h2>
          </div>
          <div className="cta-form-side">
            <p>
              Join the early-access list for research updates, product progress,
              and future testing opportunities.
            </p>
            <WaitlistForm />
            <a href={`mailto:${content.contact.collaboration}?subject=Frame%20research%20collaboration`} className="collaboration-link">
              Interested in research or engineering collaboration? <ArrowIcon />
            </a>
          </div>
        </div>
        <SignalMark />
      </section>

      <footer className="site-footer" id="privacy">
        <div className="container footer-top">
          <a className="wordmark wordmark--footer" href="#top">Frame<span>.</span></a>
          <div className="footer-links">
            <a href="#product">Product</a>
            <a href="#research">Research</a>
            <a href={`mailto:${content.contact.general}`}>Contact</a>
            <a href="#privacy">Privacy</a>
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
  );
}
