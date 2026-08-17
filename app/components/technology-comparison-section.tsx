const NATURE_RESEARCH_URL =
  "https://www.nature.com/articles/s41551-024-01279-3";

const comparisonProducts = [
  "Frame",
  "Hilo",
  "WHOOP",
  "Apple Watch",
  "Samsung Galaxy Watch",
] as const;

const comparisonRows = [
  {
    label: "Primary BP approach",
    values: [
      "Ultrasound",
      "Optical PPG",
      "Optical PPG + wearable biometrics",
      "Optical sensing / hypertension patterns",
      "Wrist-based BP algorithm",
    ],
  },
  {
    label: "Sensor location",
    values: ["Upper arm", "Wrist", "Wrist", "Wrist", "Wrist"],
  },
  {
    label: "Numerical BP",
    values: [
      "Designed to provide BP estimates",
      "Yes",
      "Daily BP estimates",
      "No continuous BP number",
      "Yes, where supported",
    ],
  },
  {
    label: "Monitoring approach",
    values: [
      "Designed for day + night patterns",
      "Automated wearable readings",
      "Primarily sleep-derived daily estimate",
      "Background hypertension pattern detection",
      "On-demand BP measurements",
    ],
  },
  {
    label: "Cuff calibration",
    values: [
      "Under validation",
      "Required",
      "Required",
      "Not applicable to BP-number measurement",
      "Periodic cuff calibration",
    ],
  },
  {
    label: "Built specifically around BP",
    values: ["Yes", "Yes", "No", "No", "No"],
  },
  {
    label: "Core sensing distinction",
    values: [
      "Arterial mechanics using ultrasound",
      "Optical pulse waveform",
      "Wearable optical / physiological signals",
      "Hypertension-pattern detection",
      "Calibrated smartwatch BP",
    ],
  },
] as const;

const validationItems = [
  ["Accuracy", "How closely Frame tracks reference measurements."],
  ["Calibration", "How little individual calibration the final system requires."],
  [
    "Coverage",
    "How consistently Frame can capture usable signals across the day and night.",
  ],
  [
    "Movement",
    "How reliably measurements can be captured during everyday activity.",
  ],
  [
    "Long-term stability",
    "How performance changes over hours, days and repeated wear.",
  ],
] as const;

function OpticalSensingDiagram() {
  return (
    <svg
      className="technology-schematic technology-schematic--optical"
      viewBox="0 0 360 250"
      role="img"
      aria-labelledby="optical-diagram-title optical-diagram-description"
    >
      <title id="optical-diagram-title">Optical sensing at the skin</title>
      <desc id="optical-diagram-description">
        A light-based wrist sensor emits light into tissue and detects changes in
        the optical pulse above an artery.
      </desc>
      <rect className="technology-schematic__tissue" x="18" y="82" width="324" height="146" rx="18" />
      <path className="technology-schematic__skin" d="M18 101H342" />
      <path className="technology-schematic__layer" d="M18 145H342" />
      <rect className="technology-schematic__sensor" x="111" y="23" width="138" height="52" rx="18" />
      <rect className="technology-schematic__sensor-face" x="150" y="61" width="60" height="12" rx="6" />
      <circle className="technology-schematic__optical-emitter technology-schematic__optical-emitter--green" cx="169" cy="67" r="4" />
      <circle className="technology-schematic__optical-emitter technology-schematic__optical-emitter--red" cx="191" cy="67" r="4" />
      <path className="technology-schematic__optical-ray technology-schematic__optical-ray--one" d="M169 73C157 104 148 125 154 151" />
      <path className="technology-schematic__optical-ray technology-schematic__optical-ray--two" d="M191 73C203 105 211 128 204 151" />
      <path className="technology-schematic__optical-ray technology-schematic__optical-ray--return" d="M160 151C164 121 169 99 177 74" />
      <ellipse className="technology-schematic__artery technology-schematic__artery--pulse" cx="180" cy="184" rx="87" ry="24" />
      <ellipse className="technology-schematic__artery-lumen" cx="180" cy="184" rx="71" ry="12" />
      <path className="technology-schematic__pulse-line" d="M247 128h18l7-15 12 30 9-15h20" />
      <text className="technology-schematic__label" x="31" y="96">skin</text>
      <text className="technology-schematic__label" x="31" y="138">tissue</text>
      <text className="technology-schematic__label" x="31" y="189">artery</text>
    </svg>
  );
}

function CuffDiagram() {
  return (
    <svg
      className="technology-schematic technology-schematic--cuff"
      viewBox="0 0 360 250"
      role="img"
      aria-labelledby="cuff-diagram-title cuff-diagram-description"
    >
      <title id="cuff-diagram-title">Inflatable upper-arm cuff</title>
      <desc id="cuff-diagram-description">
        An inflatable cuff surrounds the upper arm and temporarily compresses
        the artery during an individual blood-pressure measurement.
      </desc>
      <rect className="technology-schematic__arm" x="75" y="27" width="210" height="196" rx="96" />
      <rect className="technology-schematic__cuff-band" x="48" y="68" width="264" height="113" rx="52" />
      <rect className="technology-schematic__cuff-bladder" x="66" y="84" width="228" height="81" rx="39" />
      <path className="technology-schematic__pressure-arrow" d="M180 91v29m-8-9 8 9 8-9" />
      <path className="technology-schematic__pressure-arrow" d="M180 158v-28m-8 9 8-9 8 9" />
      <ellipse className="technology-schematic__artery technology-schematic__artery--compressed" cx="180" cy="125" rx="60" ry="12" />
      <ellipse className="technology-schematic__artery-lumen technology-schematic__artery-lumen--compressed" cx="180" cy="125" rx="45" ry="4" />
      <path className="technology-schematic__cuff-tube" d="M286 106c38-4 43 7 43 36v29" />
      <circle className="technology-schematic__cuff-gauge" cx="329" cy="186" r="17" />
      <path className="technology-schematic__gauge-hand" d="M329 186l7-8" />
      <text className="technology-schematic__label technology-schematic__label--light" x="75" y="61">upper arm</text>
      <text className="technology-schematic__label technology-schematic__label--light" x="75" y="199">inflatable cuff</text>
    </svg>
  );
}

function FrameUltrasoundDiagram() {
  return (
    <svg
      className="technology-schematic technology-schematic--frame"
      viewBox="0 0 360 250"
      role="img"
      aria-labelledby="frame-diagram-title frame-diagram-description"
    >
      <title id="frame-diagram-title">Frame pulse-echo ultrasound sensing</title>
      <desc id="frame-diagram-description">
        A slim upper-arm module sends ultrasound pulses through tissue. Echoes
        return from the anterior and posterior walls of the brachial artery as
        the vessel subtly expands and contracts.
      </desc>
      <rect className="technology-schematic__frame-tissue" x="18" y="83" width="324" height="145" rx="18" />
      <path className="technology-schematic__frame-skin" d="M18 101H342" />
      <path className="technology-schematic__frame-layer" d="M18 147H342" />
      <path className="technology-schematic__frame-strap" d="M50 44h72m116 0h72" />
      <rect className="technology-schematic__frame-module" x="112" y="20" width="136" height="56" rx="22" />
      <rect className="technology-schematic__frame-face" x="144" y="61" width="72" height="13" rx="6" />
      <path className="technology-schematic__ultrasound-beam" d="M158 74 112 196h136L202 74Z" />
      <path className="technology-schematic__ultrasound-wave technology-schematic__ultrasound-wave--one" d="M161 91q19 16 38 0" />
      <path className="technology-schematic__ultrasound-wave technology-schematic__ultrasound-wave--two" d="M145 116q35 27 70 0" />
      <path className="technology-schematic__ultrasound-wave technology-schematic__ultrasound-wave--three" d="M128 145q52 38 104 0" />
      <path className="technology-schematic__echo technology-schematic__echo--one" d="M139 183 166 76" />
      <path className="technology-schematic__echo technology-schematic__echo--two" d="M221 207 195 76" />
      <path className="technology-schematic__artery-wall technology-schematic__artery-wall--anterior" d="M94 184Q180 158 266 184" />
      <path className="technology-schematic__artery-wall technology-schematic__artery-wall--posterior" d="M94 207Q180 233 266 207" />
      <path className="technology-schematic__artery-fill" d="M94 184Q180 158 266 184L266 207Q180 233 94 207Z" />
      <path className="technology-schematic__wall-motion technology-schematic__wall-motion--up" d="M180 177v-13m-6 6 6-6 6 6" />
      <path className="technology-schematic__wall-motion technology-schematic__wall-motion--down" d="M180 214v13m-6-6 6 6 6-6" />
      <path className="technology-schematic__distension-wave" d="M259 133h15l5-9 8 18 7-12 8 6h26" />
      <text className="technology-schematic__frame-label" x="27" y="97">skin</text>
      <text className="technology-schematic__frame-label" x="27" y="140">tissue</text>
      <text className="technology-schematic__frame-label" x="252" y="180">anterior wall</text>
      <text className="technology-schematic__frame-label" x="252" y="220">posterior wall</text>
    </svg>
  );
}

function SensingApproaches() {
  const approaches = [
    {
      key: "optical",
      number: "01",
      title: "Optical sensing",
      label: "Measures changes in the optical pulse",
      description:
        "Light-based sensors detect changes in blood volume and pulse-wave characteristics at the skin.",
      diagram: <OpticalSensingDiagram />,
    },
    {
      key: "cuff",
      number: "02",
      title: "Inflatable cuff",
      label: "Temporarily compresses the artery",
      description:
        "Traditional cuffs estimate pressure during an individual measurement while the artery is compressed.",
      diagram: <CuffDiagram />,
    },
    {
      key: "frame",
      number: "03",
      title: "Frame ultrasound",
      label: "Observes arterial mechanics",
      description:
        "Frame is being built to track arterial wall motion and geometry using pulse-echo ultrasound.",
      diagram: <FrameUltrasoundDiagram />,
    },
  ] as const;

  return (
    <figure className="technology-sensing-figure">
      <div className="technology-sensing-grid">
        {approaches.map((approach) => (
          <article
            className={`technology-sensing-card technology-sensing-card--${approach.key}`}
            key={approach.key}
          >
            <header>
              <span>{approach.number}</span>
              <h3>{approach.title}</h3>
            </header>
            <div className="technology-sensing-card__visual">
              {approach.diagram}
            </div>
            <div className="technology-sensing-card__copy">
              <h4>{approach.label}</h4>
              <p>{approach.description}</p>
            </div>
          </article>
        ))}
      </div>
      <figcaption className="technology-sensing-payoff">
        <span>Different sensing physics.</span>
        <strong>Different information.</strong>
      </figcaption>
    </figure>
  );
}

function DesktopComparison() {
  return (
    <div className="technology-comparison-table-wrap">
      <table className="technology-comparison-table">
        <caption className="sr-only">
          Comparison of blood-pressure sensing and monitoring approaches used by
          Frame, Hilo, WHOOP, Apple Watch, and Samsung Galaxy Watch.
        </caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            {comparisonProducts.map((product, productIndex) => (
              <th
                className={productIndex === 0 ? "is-frame" : undefined}
                scope="col"
                key={product}
              >
                {productIndex === 0 ? <span>In development</span> : null}
                {product}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparisonRows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, productIndex) => (
                <td
                  className={productIndex === 0 ? "is-frame" : undefined}
                  key={`${row.label}-${comparisonProducts[productIndex]}`}
                >
                  {row.label === "Cuff calibration" && productIndex === 0 ? (
                    <strong>{value}</strong>
                  ) : row.label === "Core sensing distinction" && productIndex === 0 ? (
                    <strong>{value}</strong>
                  ) : (
                    value
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileComparison() {
  return (
    <div
      className="technology-comparison-cards"
      role="region"
      aria-label="Scrollable wearable technology comparison"
      tabIndex={0}
    >
      {comparisonProducts.map((product, productIndex) => (
        <article
          className={`technology-comparison-card${productIndex === 0 ? " is-frame" : ""}`}
          key={product}
        >
          <header>
            <span>{productIndex === 0 ? "In development" : `0${productIndex + 1}`}</span>
            <h4>{product}</h4>
          </header>
          <dl>
            {comparisonRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.values[productIndex]}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

function WearableComparison() {
  return (
    <div className="technology-comparison-block">
      <div className="technology-comparison-heading">
        <div>
          <p className="eyebrow">Technology, side by side</p>
          <h3>How Frame compares</h3>
        </div>
        <p>
          Products that discuss blood pressure can rely on very different
          sensing methods.
        </p>
      </div>
      <DesktopComparison />
      <MobileComparison />
      <p className="technology-comparison-note">
        This is a comparison of sensing and monitoring approaches—not an
        accuracy ranking. Features, regulatory status, and availability vary by
        region. Sources: {" "}
        <a href="https://hilo.com/en-eu/pages/science" target="_blank" rel="noreferrer">Hilo</a>,{ " "}
        <a href="https://www.whoop.com/us/en/thelocker/blood-pressure-insights-accuracy/" target="_blank" rel="noreferrer">WHOOP</a>,{ " "}
        <a href="https://support.apple.com/en-us/117296" target="_blank" rel="noreferrer">Apple</a>, and{ " "}
        <a href="https://www.samsung.com/us/support/answer/ANS10010530/" target="_blank" rel="noreferrer">Samsung</a>.
      </p>
    </div>
  );
}

function ResearchEvidence() {
  return (
    <div className="technology-research" id="research">
      <div className="technology-research__intro">
        <p className="eyebrow">The research</p>
        <h3>Wearable ultrasound is an emerging field of cardiovascular sensing.</h3>
        <p>
          Independent researchers have demonstrated continuous, non-invasive
          blood-pressure monitoring using wearable ultrasound in human studies.
          Frame is developing its own implementation and will validate its
          performance independently before launch.
        </p>
      </div>
      <article className="technology-research-card">
        <div className="technology-research-card__meta">
          <span>Independent research</span>
          <time dateTime="2025">2025</time>
        </div>
        <p className="technology-research-card__journal">
          Nature Biomedical Engineering
        </p>
        <h4>Wearable ultrasound blood-pressure monitoring</h4>
        <p>
          A wearable ultrasound system was evaluated for continuous
          blood-pressure monitoring across human studies and multiple use
          conditions.
        </p>
        <a href={NATURE_RESEARCH_URL} target="_blank" rel="noreferrer">
          Read the research <span aria-hidden="true">→</span>
        </a>
        <small>Independent research — not a validation study of Frame.</small>
      </article>
    </div>
  );
}

function ValidationTransparency() {
  return (
    <div className="technology-validation">
      <div className="technology-validation__heading">
        <p className="eyebrow">Validation roadmap</p>
        <h3>We&apos;re proving Frame, not asking you to take our word for it.</h3>
        <p>
          Before launch, we&apos;re testing the parts of the system that matter most.
        </p>
      </div>
      <ol className="technology-validation-grid">
        {validationItems.map(([title, description], index) => (
          <li key={title}>
            <span>0{index + 1}</span>
            <h4>{title}</h4>
            <p>{description}</p>
          </li>
        ))}
      </ol>
      <p className="technology-validation__close">
        We&apos;ll share results as development progresses.
      </p>
    </div>
  );
}

export function TechnologyComparisonSection() {
  return (
    <section
      className="technology-comparison-section section"
      aria-labelledby="technology-comparison-heading"
    >
      <div className="container">
        <div className="technology-comparison-intro">
          <p className="eyebrow">Why Frame is different</p>
          <h2 id="technology-comparison-heading">
            Most wearables look at the pulse. Frame looks at the artery.
          </h2>
          <p>
            Most wearable blood-pressure approaches rely on signals measured at
            the wrist. Frame is being built around ultrasound at the upper arm,
            allowing it to observe arterial motion beneath the skin.
          </p>
        </div>
        <SensingApproaches />
        <WearableComparison />
        <ResearchEvidence />
        <ValidationTransparency />
      </div>
    </section>
  );
}
