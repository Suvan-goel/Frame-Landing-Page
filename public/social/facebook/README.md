# Frame Facebook ad campaign — v1

This campaign pairs professional lifestyle and product photography with deterministic brand typography so the product remains consistent and every line of ad copy stays crisp.

The device is shown on the lower upper arm, approximately 2–4 cm above the elbow crease and below the biceps. The imagery uses the current Frame concept: black engineered-knit band, charcoal sensor housing, and burgundy clasp.

## Exported creatives

| Concept | Feed (4:5) | Square (1:1) | Story/Reels (9:16) |
| --- | --- | --- | --- |
| Product | `frame-facebook-product-feed-v4.png` | `frame-facebook-product-square-v4.png` | `frame-facebook-product-story-v4.png` |
| Routine | `frame-facebook-routine-feed-v1.png` | `frame-facebook-routine-square-v1.png` | `frame-facebook-routine-story-v1.png` |
| Movement | `frame-facebook-movement-feed-v1.png` | `frame-facebook-movement-square-v1.png` | `frame-facebook-movement-story-v1.png` |

Dimensions:

- Feed: 1080 × 1350 px
- Square: 1080 × 1080 px
- Story/Reels: 1080 × 1920 px

## Ads Manager copy

### 1. Product-first — “See what influences your blood pressure”

Primary text:

> Blood pressure changes across sleep, rest, stress, movement, and recovery. Frame is developing a screenless ultrasound wearable to help explore those patterns across everyday life. Apply for early access. Research-stage concept; not intended to diagnose or treat.

- Headline: `See what influences your blood pressure`
- Description: `Join Frame’s early-access program.`
- CTA button: `Sign Up`
- Best use: cold prospecting and product introduction

### 2. Morning routine — “Your baseline is personal.”

Primary text:

> Your baseline is personal. Frame is designed to explore patterns against your own context—not a generic average. We’re inviting a small group of early users to help shape what comes next. Research-stage concept; not intended to diagnose or treat.

- Headline: `Your baseline is personal.`
- Description: `Help shape Frame.`
- CTA button: `Sign Up`
- Best use: problem-aware audiences and landing-page retargeting

### 3. Everyday movement — “Patterns over moments.”

Primary text:

> One reading captures a moment. Frame is exploring wearable ultrasound to understand patterns around everyday life—without putting another screen on your arm. Apply for early access. Research-stage concept; not intended to diagnose or treat.

- Headline: `Patterns over moments.`
- Description: `Apply for early access.`
- CTA button: `Sign Up`
- Best use: lifestyle-led prospecting and social placements

## Launch notes

- Send each concept to the existing early-access landing page.
- Use the 4:5 versions for Facebook and Instagram feeds, 1:1 for flexible placements, and 9:16 for Stories/Reels.
- The 9:16 layouts keep the key message and CTA away from the top and bottom interface zones.
- Keep the research-stage disclosure visible. Do not replace it with diagnostic, treatment, guaranteed-outcome, or currently-for-sale claims.
- Product v4 intentionally has no simulated button in the artwork. Select Meta’s native `Sign Up` CTA in Ads Manager; that is the actual clickable control.

## Regeneration

Run:

```bash
npm run creative:facebook
```

The generator reads the approved ImageGen source photographs from `public/social/imagegen/exports/` and writes all nine final files to this directory.
