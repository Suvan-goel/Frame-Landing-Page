/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { BrandWordmark } from "./components/brand-wordmark";
import { MobileNavigation } from "./components/mobile-navigation";
import { MobilePersistentPreorder } from "./components/mobile-persistent-preorder";
import { MobileWaitlistDisclosure } from "./components/mobile-waitlist-disclosure";
import {
  WaitlistSignupFlow,
  WaitlistSignupProvider,
} from "./components/waitlist-signup-flow";
import { isFoundingContributorSalesPageEnabled } from "@/lib/contributor-sales-page.server";
import { getPreorderConfiguration } from "@/lib/preorder-config.server";
import { isPreorderSalesPageEnabled } from "@/lib/preorder-sales-page.server";
import {
  formatPreorderMoney,
  PREORDER_DISCOUNT_PERCENT,
  PREORDER_RELEASE_PRICE_CENTS,
} from "@/lib/preorder";
import { companyLegalIdentityLine } from "@/lib/company";
import { INSTAGRAM_URL, ORGANIZATION_NAME } from "@/lib/site";

const content = {
  navigation: [
    { label: "Product", href: "#product" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Research", href: "#research" },
  ],
  insights: [
    ["Baseline", "What is typical for you during comparable periods."],
    ["Recovery", "How quickly you return toward your usual pattern."],
    ["Response", "How your cardiovascular system changes around meaningful events."],
    ["Confidence", "What was measured reliably, and what was not."],
  ],
  principles: [
    [
      "Screenless by design",
      "No glowing display or constant alerts. Frame keeps your attention on life, not the device.",
    ],
    [
      "Built around comfort",
      "A soft, adjustable upper-arm form designed for comfortable everyday wear.",
    ],
    [
      "Quietly continuous",
      "Frame works in the background while you sleep, move, work, and recover.",
    ],
    [
      "Complex technology, clear experience",
      "Wearable ultrasound and machine learning do the complex work; the app brings meaningful patterns into view.",
    ],
  ],
  researchStandards: [
    {
      metric: "118",
      title: "adults recruited",
      description:
        "A clinical validation study tested a wearable ultrasound sensor during daily activities and in outpatient, cardiac catheterisation, and intensive-care settings.",
    },
    {
      metric: null,
      title: "Compared with clinical references",
      description:
        "Ultrasound-derived measurements have been evaluated against arm cuffs, arterial tonometry, and invasive arterial lines.",
    },
  ],
} as const;

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default async function Home() {
  const [showLocalContributorAreas, showPreorderAreas] = await Promise.all([
    isFoundingContributorSalesPageEnabled(),
    isPreorderSalesPageEnabled(),
  ]);
  const preorderOffer = showPreorderAreas
    ? await getPreorderConfiguration()
    : null;
  const preorderPriceLabel = preorderOffer
    ? formatPreorderMoney(preorderOffer.priceCents, preorderOffer.currency)
    : null;
  const preorderReleasePriceLabel = preorderOffer
    ? formatPreorderMoney(PREORDER_RELEASE_PRICE_CENTS, preorderOffer.currency)
    : null;
  const preorderSavingsCents = preorderOffer
    ? Math.max(0, PREORDER_RELEASE_PRICE_CENTS - preorderOffer.priceCents)
    : 0;
  const preorderSavingsLabel = preorderOffer
    ? formatPreorderMoney(preorderSavingsCents, preorderOffer.currency)
    : null;
  const preorderHref = "/preorder/review?source=homepage";
  const legalIdentityLine = companyLegalIdentityLine();
  const mobileNavigation = [
    ...content.navigation,
    ...(preorderOffer
      ? [{ label: "Pricing", href: "#preorder" } as const]
      : []),
    ...(showLocalContributorAreas
      ? [{ label: "Contributors", href: "/founding-contributors" } as const]
      : []),
  ];

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
            {preorderOffer ? <a href="#preorder">Pricing</a> : null}
            {showLocalContributorAreas ? (
              <a href="/founding-contributors">Contributors</a>
            ) : null}
          </div>
          <a
            className="nav-cta"
            href={
              preorderOffer
                ? "/preorder/review?source=homepage_header"
                : "#homepage-hero-waitlist"
            }
          >
            {preorderOffer
              ? `Pre-order now - ${preorderPriceLabel}`
              : "Get updates"}
          </a>
          {preorderOffer ? (
            <MobilePersistentPreorder
              href="/preorder/review?source=homepage_mobile_header"
              priceLabel={preorderPriceLabel!}
            />
          ) : null}
          <MobileNavigation
            items={mobileNavigation}
            offerLabel={
              preorderOffer && preorderSavingsLabel
                ? `Pre-order offer · Save ${preorderSavingsLabel}`
                : undefined
            }
            primaryItem={
              preorderOffer
                ? {
                    label: "Pre-order now",
                    href: "/preorder/review?source=homepage_mobile",
                  }
                : undefined
            }
          />
        </nav>
      </header>

      <section className="hero hero--email-first" id="top">
        <div className="hero-grid container">
          <div className="hero-copy">
            <p className="eyebrow hero-email-first__eyebrow">
              <span className="hero-eyebrow__desktop">
                MEASURE YOUR BLOOD PRESSURE CONTINUOUSLY
              </span>
              {preorderOffer ? (
                <span className="hero-email-first__shipping-pill hero-eyebrow__desktop">
                  Shipping est. {preorderOffer.estimatedShipping}
                </span>
              ) : null}
              <span className="hero-eyebrow__mobile">
                {preorderOffer
                  ? `SHIPPING EST. ${preorderOffer.estimatedShipping}`
                  : "MEASURE YOUR BLOOD PRESSURE CONTINUOUSLY"}
              </span>
            </p>
            <h1>
              <span className="hero-heading__desktop">
                See how your blood pressure responds to daily life
              </span>
              <span className="hero-heading__mobile">
                See how your blood pressure responds to daily life
              </span>
            </h1>
            <p className="hero-intro">
              <span className="hero-intro__desktop">
                The first wearable to continuously track blood pressure
                accurately and reliably
              </span>
              <span className="hero-intro__mobile">
                The first wearable to continuously track blood pressure
                accurately and reliably
              </span>
            </p>
            {preorderOffer ? (
              <div className="home-preorder-hero">
                <figure className="home-preorder-hero__mobile-product">
                  <img
                    src="/frame-product-concept-realistic-v3-transparent-480w.webp"
                    alt="Frame upper-arm wearable preview"
                    width={480}
                    height={480}
                    loading="eager"
                    decoding="async"
                  />
                </figure>
                <p className="home-preorder-hero__offer-line">
                  <span className="home-preorder-hero__offer-tag">Pre order offer</span>
                  <span className="home-preorder-hero__offer-message">
                    Pre-order today and save {PREORDER_DISCOUNT_PERCENT}%
                  </span>
                </p>
                <div
                  className="home-preorder-hero__mobile-offer"
                  aria-label={`Pre-order offer; save ${preorderSavingsLabel}`}
                >
                  <span className="home-preorder-hero__offer-tag">
                    Pre-order offer
                  </span>
                  <span
                    className="home-preorder-hero__mobile-offer-separator"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                  <span className="home-preorder-hero__mobile-offer-saving">
                    Save <strong>{preorderSavingsLabel}</strong>
                  </span>
                </div>
                <div className="home-preorder-hero__actions">
                  <a
                    className="button home-preorder-hero__preorder-button"
                    href="/preorder/review?source=homepage_hero"
                  >
                    <span className="home-preorder-hero__cta-desktop">Pre-order now</span>
                    <span className="home-preorder-hero__cta-mobile">
                      Pre-order for {preorderPriceLabel}
                    </span>
                  </a>
                  <a className="home-preorder-hero__details-button" href="#preorder">
                    <span className="home-preorder-hero__details-label">See details</span>
                    <span aria-hidden="true">↓</span>
                  </a>
                </div>
                <MobileWaitlistDisclosure>
                  <WaitlistSignupFlow
                    placement="homepage_hero_preorder_waitlist"
                    compact
                    usePreorderLaunchCopy={showPreorderAreas}
                  />
                </MobileWaitlistDisclosure>
              </div>
            ) : (
              <WaitlistSignupFlow
                placement="homepage_hero"
                compact
                usePreorderLaunchCopy={showPreorderAreas}
              />
            )}
          </div>
          <figure
            className={`hero-visuals hero-visuals--product${showPreorderAreas ? " hero-visuals--preorder" : ""}`}
          >
            <div className="hero-lifestyle hero-lifestyle--product">
              <img
                src="/frame-product-concept-realistic-v3-transparent-720w.webp"
                srcSet="/frame-product-concept-realistic-v3-transparent-480w.webp 480w, /frame-product-concept-realistic-v3-transparent-720w.webp 720w, /frame-product-concept-realistic-v3-transparent-960w.webp 960w"
                alt="Frame upper-arm wearable preview"
                width={1254}
                height={1254}
                sizes="(max-width: 680px) 84vw, (max-width: 1279px) 620px, 38vw"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          </figure>
        </div>
      </section>

      <section className="context-section section">
        <div className="container context-container" id="product">
          <div className="context-intro">
            <p className="eyebrow">Why context matters</p>
            <h2>A single reading cannot show a pattern.</h2>
            <p className="context-intro__description">
              <span className="context-intro__desktop">
                {showPreorderAreas
                  ? "Blood pressure changes with sleep, movement, stress, exercise, food, posture, and recovery. Most people only see an occasional snapshot. Frame is built to connect what happens in between, helping you see how personal patterns relate to everyday life."
                  : "Blood pressure changes with sleep, movement, stress, exercise, food, posture, and recovery. Most people only see an occasional snapshot. Frame aims to connect what happens in between, helping you see how personal patterns relate to everyday life."}
              </span>
              <span className="context-intro__mobile">
                Blood pressure changes with sleep, stress, movement, and
                recovery. Frame is designed to connect those moments, helping
                reveal patterns an occasional reading may miss.
              </span>
            </p>
          </div>
          <figure className="context-lifestyle-visual">
            <img
              src="/frame-woman-dumbbell-upper-arm-transparent-v1.png"
              alt="Woman lifting a dumbbell while wearing Frame just above her elbow"
              width={1672}
              height={941}
              sizes="(max-width: 680px) calc(100vw - 32px), (max-width: 1200px) 84vw, 1100px"
              loading="lazy"
              decoding="async"
            />
            <figcaption>Worn on the upper arm</figcaption>
          </figure>
          <div
            className={`context-content${showPreorderAreas ? " context-content--without-product" : ""}`}
          >
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
            {!showPreorderAreas ? (
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
              </figure>
            ) : null}
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
            <div
              className="context-mobile-insight-list"
              aria-label="How Frame creates context"
            >
              {[
                ["Baseline", "What is typical for you during comparable periods."],
                ["Response", "How your blood pressure changes around meaningful events."],
                ["Recovery", "How quickly you return toward your usual pattern."],
                ["Confidence", "How intelligent signal analysis keeps your patterns clear."],
              ].map(([title, description], index) => (
                <article key={title}>
                  <span>0{index + 1}</span>
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

      <section className="method-section section">
        <div className="container" id="how-it-works">
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2>Ultrasound, made wearable.</h2>
            <p>
              <span className="method-intro__desktop">
                {showPreorderAreas
                  ? "Ultrasound can observe arterial motion beneath the skin. Frame combines cutting-edge wearable ultrasound technology, contextual sensing, and personalised analysis to show how those signals change over time."
                  : "Ultrasound can observe arterial motion beneath the skin. Frame is exploring how to make that signal dependable, comfortable, and useful over time."}
              </span>
              <span className="method-intro__mobile">
                Frame combines cutting-edge wearable ultrasound technology with
                movement, contact, sleep, and activity sensing to reveal patterns
                over time.
              </span>
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
                <span className="method-caption__desktop">
                  {showPreorderAreas
                    ? "simplified illustration"
                    : "Simplified sensing concept · anatomy and final sensor configuration are illustrative"}
                </span>
                <span className="method-caption__mobile">
                  simplified illustration
                </span>
              </figcaption>
            </figure>
            <ol className="method-steps method-steps--desktop">
              <li>
                <span>01</span>
                <div>
                  <h3>Observe</h3>
                  <p>
                    A specialised sensor sends and receives high-frequency
                    ultrasound waves to observe the artery beneath the skin.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Interpret</h3>
                  <p>
                    Arterial features are analysed using a personalised
                    machine-learning model.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Add context</h3>
                  <p>
                    Motion, contact, temperature, sleep, and activity data help
                    the model understand changes in the ultrasound signal.
                  </p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <h3>Show what is trusted</h3>
                  <p>Lower-confidence or interrupted periods remain clearly marked.</p>
                </div>
              </li>
            </ol>
            <ol className="method-steps method-steps--mobile">
              <li>
                <span>01</span>
                <div>
                  <h3>Observe</h3>
                  <p>
                    Wearable ultrasound uses high-frequency sound waves to
                    observe arterial motion beneath the skin.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Add context</h3>
                  <p>
                    Movement, contact, sleep, and activity data help explain
                    changes in the ultrasound signal.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Reveal patterns</h3>
                  <p>
                    Personalised machine-learning analysis combines ultrasound
                    signals with daily context to reveal clear patterns over time.
                  </p>
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
              src="/frame-app-studio-v6-640w.webp"
              srcSet="/frame-app-studio-v6-480w.webp 480w, /frame-app-studio-v6-640w.webp 640w, /frame-app-studio-v6-896w.webp 896w"
              alt="Frame companion app showing 8 hours 12 minutes of overnight coverage, a continuous overnight waveform, and a late meal timing pattern"
              className="cover-image"
              width={896}
              height={1717}
              sizes="(max-width: 980px) calc(100vw - 64px), 58vw"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <div className="software-copy">
            <p className="eyebrow">The experience</p>
            <h2>
              <span className="software-heading__desktop">
                From measurements to personal experiments.
              </span>
              <span className="software-heading__mobile">
                See the patterns behind your readings.
              </span>
            </h2>
            <p>
              <span className="software-intro__desktop">
                Frame is designed to explain patterns relative to your baseline,
                show how long a response lasts, and make confidence part of every
                result.
              </span>
              <span className="software-intro__mobile">
                See what is typical for you, how your body responds, and how
                long changes last.
              </span>
            </p>
            <blockquote>
              <span>Pattern to explore</span>
              “On three similar nights, later meals were associated with higher
              overnight readings.”
            </blockquote>
          </div>
        </div>
      </section>

      {preorderOffer ? (
        <section className="home-preorder-section">
          <div className="container home-preorder-container" id="preorder">
            <div className="home-preorder-layout">
              <div className="home-preorder-copy">
                <p className="eyebrow">
                  <span className="home-preorder-copy__eyebrow-desktop">
                    Frame pre-order
                  </span>
                  <span className="home-preorder-copy__eyebrow-mobile">
                    Pre-order offer
                  </span>
                </p>
                <h2>
                  <span className="home-preorder-copy__heading-desktop">
                    Coming Q1 2027.
                  </span>
                  <span className="home-preorder-copy__heading-mobile">
                    Reserve your Frame.
                  </span>
                </h2>
                <p className="home-preorder-copy__intro">
                  <span className="home-preorder-copy__intro-desktop">
                    A {preorderPriceLabel} pre-order reserves one Frame upper-arm
                    wearable at {PREORDER_DISCOUNT_PERCENT}% below the planned{" "}
                    {preorderReleasePriceLabel} release price.
                  </span>
                  <span className="home-preorder-copy__intro-mobile">
                    Shipping is estimated for Q1 2027.
                  </span>
                </p>

                <dl
                  className="home-preorder-price-comparison home-preorder-price-comparison--section"
                  aria-label="Frame pre-order pricing"
                >
                  <div className="home-preorder-price-comparison__pair">
                    <div>
                      <dt>Pre-order price</dt>
                      <dd>{preorderPriceLabel}</dd>
                    </div>
                    <div>
                      <dt>Release price</dt>
                      <dd><del>{preorderReleasePriceLabel}</del></dd>
                    </div>
                  </div>
                  <div className="home-preorder-price-comparison__saving">
                    <div>
                      <dt>You save</dt>
                      <dd>{preorderSavingsLabel}</dd>
                    </div>
                    <span>{PREORDER_DISCOUNT_PERCENT}% off</span>
                  </div>
                </dl>

                <div
                  className="home-preorder-mobile-price-card"
                  aria-label={`${preorderPriceLabel} pre-order price. Save ${preorderSavingsLabel}, ${PREORDER_DISCOUNT_PERCENT}% off the planned ${preorderReleasePriceLabel} release price.`}
                >
                  <span>Pre-order price</span>
                  <div className="home-preorder-mobile-price-card__price-row">
                    <strong>{preorderPriceLabel}</strong>
                    <span>Save {preorderSavingsLabel}</span>
                  </div>
                  <p>
                    <span>
                      {PREORDER_DISCOUNT_PERCENT}% off the planned{" "}
                      <del>{preorderReleasePriceLabel}</del> release price
                    </span>
                  </p>
                </div>

                <p className="home-preorder-price-note home-preorder-price-note--desktop">
                  Applicable sales tax is added at checkout. Standard US shipping is free.
                  Cancel any time before fulfilment for a full refund.
                </p>

                <div className="home-preorder-actions">
                  <a className="button button--dark" href={preorderHref}>
                    <span className="home-preorder-actions__label-desktop">
                      Pre-order now
                    </span>
                    <span className="home-preorder-actions__label-mobile">
                      Pre-order now
                    </span>
                    <Arrow />
                  </a>
                  <ul
                    className="home-preorder-price-note home-preorder-price-note--mobile"
                    aria-label="Pre-order reassurance"
                  >
                    <li>US shipping included · Refundable before fulfilment</li>
                  </ul>
                  <a className="text-link" href="/preorder/product-status">
                    <span className="home-preorder-progress-label__desktop">
                      Product progress and shipping plan
                    </span>
                    <span className="home-preorder-progress-label__mobile">
                      Product and shipping details
                    </span>
                    <Arrow />
                  </a>
                </div>

                <div className="home-preorder-links" aria-label="Pre-order policies">
                  <a href="/preorder/terms">Pre-order Terms</a>
                  <a href="/preorder/refunds">Cancellation &amp; Refund Policy</a>
                </div>
              </div>

              <figure className="home-preorder-visual home-preorder-visual--device-cutout">
                <img
                  src="/generated/frame-device-front-reference-clasp-transparent-v4.png"
                  alt="Front-facing Frame wearable concept with a centered inner sensor and opposing rose-metal clasp"
                  width={1254}
                  height={1254}
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            </div>

          </div>
        </section>
      ) : null}

      <section className="principles-section section">
        <div className="container principles-grid">
          <div className="principles-copy">
            <p className="eyebrow">Product principles</p>
            <h2>
              <span className="principles-heading__desktop">
                Advanced technology, effortless to live with.
              </span>
              <span className="principles-heading__mobile">
                Advanced technology. Effortless to live with.
              </span>
            </h2>
            <div className="principle-list principle-list--desktop">
              {content.principles.map(([title, description]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
            <div className="principle-list principle-list--mobile">
              {[
                [
                  "Screenless by design",
                  "No glowing screen or constant alerts. Frame works quietly in the background.",
                ],
                [
                  "Made to live in",
                  "A soft, adjustable upper-arm form designed for comfortable everyday wear.",
                ],
                [
                  "Advanced made simple",
                  "Ultrasound and machine learning do the complex work; you see the patterns that matter.",
                ],
              ].map(([title, description], index) => (
                <article key={title}>
                  <span className="principle-list__number">0{index + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <aside className="research-panel" id="research">
            <div className="research-panel__body">
              <span className="status-label">Research evidence</span>
              <h3>
                <span className="research-heading__desktop">
                  Wearable ultrasound, supported by clinical research.
                </span>
                <span className="research-heading__mobile">
                  Wearable ultrasound has been evaluated in peer-reviewed human
                  studies.
                </span>
              </h3>
              <p>
                <span className="research-intro__desktop">
                  Validated for accuracy and reliability, the tech behind Frame is
                  a game-changer for continuous blood-pressure monitoring.
                </span>
                <span className="research-intro__mobile">
                  Validated for accuracy and reliability, the tech behind Frame is
                  a game-changer for continuous blood-pressure monitoring.
                </span>
              </p>
              <div className="research-standards research-standards--desktop" aria-label="Published evidence for wearable ultrasound">
                {content.researchStandards.map((standard) => (
                  <article key={standard.title}>
                    <h4 className={standard.metric ? "research-standard-title--metric" : undefined}>
                      {standard.metric ? (
                        <>
                          <span className="research-standard-metric">{standard.metric}</span>
                          <span>{standard.title}</span>
                        </>
                      ) : standard.title}
                    </h4>
                    <p>{standard.description}</p>
                  </article>
                ))}
              </div>
              <div className="research-standards research-standards--mobile" aria-label="Published evidence for wearable ultrasound">
                <article>
                  <h4 className="research-standard-title--metric">
                    <span className="research-standard-metric">118</span>
                    <span>adults studied</span>
                  </h4>
                </article>
                <article>
                  <h4>Compared with clinical references</h4>
                </article>
              </div>
            </div>
            <a
              className="research-citation"
              href="https://www.nature.com/articles/s41551-024-01279-3"
              target="_blank"
              rel="noreferrer"
              aria-label="Read the wearable ultrasound clinical validation paper in Nature Biomedical Engineering"
            >
              Zhou et al., Nature Biomedical Engineering, 2025 <Arrow />
            </a>
          </aside>
        </div>
      </section>

      {showLocalContributorAreas ? (
        <section className="home-contributor-section">
          <div className="container home-contributor-grid">
            <div>
              <p className="eyebrow">Founding Contributors</p>
              <h2>Build Frame with us.</h2>
            </div>
            <div>
              <p>
                A one-time $99 membership gives you 12 months of private updates,
                founder Q&amp;A, briefings, advisory votes, and selected research
                opportunities. Membership is separate from the Frame device pre-order.
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
            <p className="eyebrow">Frame updates</p>
            <h2>Follow Frame through launch and beyond.</h2>
          </div>
          <div className="final-cta__form final-cta__action">
            <p className="final-cta__mobile-intro">
              Get product milestones and launch updates.
            </p>
            <WaitlistSignupFlow
              placement="homepage_final"
              tone="light"
              usePreorderLaunchCopy={showPreorderAreas}
            />
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
            <a className="footer-links__privacy" href="/privacy">Privacy</a>
            <a href="/contact">Contact</a>
          </div>
        </div>
        <div className="container footer-bottom">
          <div className="footer-bottom__disclosures">
            <p>
              {showPreorderAreas ? (
                <>
                  <span className="footer-disclosure__desktop">
                    Frame is a general-wellness wearable in development. Product visuals
                    show the intended experience
                    {preorderOffer
                      ? `; specifications and estimated ${preorderOffer.estimatedShipping} shipping may change.`
                      : "."}
                    {" "}
                    Frame is not intended to guide medical decisions or replace an
                    FDA-authorized blood-pressure monitor.
                  </span>
                  <span className="footer-disclosure__mobile">
                    Frame is a general-wellness wearable in development. Product
                    visuals, specifications and estimated{" "}
                    {preorderOffer?.estimatedShipping ?? "Q1 2027"} shipping may
                    change. It is not intended for medical decisions or to replace
                    an FDA-authorized blood-pressure monitor.
                  </span>
                </>
              ) : (
                <>
                  Frame is under development and is not currently available for sale.{" "}
                  Product concepts and interfaces shown are illustrative. Frame is being
                  developed for general wellness use and is not intended to diagnose,
                  screen for, monitor, treat, or manage any disease or medical condition,
                  guide treatment decisions, or replace an FDA-authorized medical device.
                </>
              )}
            </p>
            {legalIdentityLine ? <p className="footer-bottom__legal">{legalIdentityLine}</p> : null}
          </div>
          <div className="footer-bottom__meta">
            <p>© {new Date().getFullYear()} {ORGANIZATION_NAME}</p>
            <a className="footer-bottom__privacy" href="/privacy">Privacy</a>
          </div>
        </div>
      </footer>
    </main>
    </WaitlistSignupProvider>
  );
}
