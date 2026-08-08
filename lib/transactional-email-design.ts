export type TransactionalEmailLink = {
  label: string;
  href: string;
};

export type TransactionalEmailMarker = "check" | "arrow" | "alert" | "none";

export function escapeTransactionalEmailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markerHtml(marker: TransactionalEmailMarker) {
  if (marker === "none") return "";
  const glyph =
    marker === "check" ? "&#10003;" : marker === "alert" ? "!" : "&#8594;";
  return `<span style="color:#8d3e46;font-size:15px;vertical-align:-1px">${glyph}</span>&nbsp;&nbsp;`;
}

export function renderTransactionalSummaryPanel(input: {
  eyebrow: string;
  title?: string;
  rows: Array<{
    label: string;
    value: string;
    emphasis?: boolean;
  }>;
}) {
  const title = input.title
    ? `<p style="margin:4px 0 0;color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2">${escapeTransactionalEmailHtml(input.title)}</p>`
    : "";
  const rows = input.rows
    .map((row, index) => {
      const first = index === 0;
      const value = escapeTransactionalEmailHtml(row.value).replaceAll("\n", "<br>");
      return `<tr>
        <td valign="top" style="padding:${first ? "20px" : "8px"} 16px 8px 0;${first ? "border-top:1px solid #d8d1c5;" : ""}color:#5d5d57;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5">${escapeTransactionalEmailHtml(row.label)}</td>
        <td align="right" valign="top" style="padding:${first ? "20px" : "8px"} 0 8px;${first ? "border-top:1px solid #d8d1c5;" : ""}color:${row.emphasis ? "#8d3e46" : "#20211e"};font-family:${row.emphasis ? "Georgia,'Times New Roman',serif" : "Arial,Helvetica,sans-serif"};font-size:${row.emphasis ? "20px" : "13px"};font-weight:${row.emphasis ? "400" : "600"};line-height:1.5">${value}</td>
      </tr>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3efe6" style="width:100%;margin:28px 0 0;background:#f3efe6;border:1px solid #e4ddd1">
    <tr>
      <td class="email-summary" style="padding:26px 28px 24px">
        <p style="margin:0 0 4px;color:#74716a;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.14em;line-height:1.4;text-transform:uppercase">${escapeTransactionalEmailHtml(input.eyebrow)}</p>
        ${title}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:${input.title ? "19px" : "11px"}">
          ${rows}
        </table>
      </td>
    </tr>
  </table>`;
}

export function renderTransactionalNotice(input: {
  title: string;
  body: string;
  tone?: "neutral" | "warning" | "success";
}) {
  const tone = input.tone ?? "neutral";
  const background = tone === "warning" ? "#f8ebed" : tone === "success" ? "#edf1ea" : "#f7f4ee";
  const accent = tone === "warning" ? "#8d3e46" : tone === "success" ? "#778b75" : "#a8a39a";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${background}" style="width:100%;margin:16px 0 0;background:${background};border-left:3px solid ${accent}">
    <tr>
      <td style="padding:17px 19px;color:#5c5c56;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.65"><strong style="color:#20211e">${escapeTransactionalEmailHtml(input.title)}</strong> ${escapeTransactionalEmailHtml(input.body)}</td>
    </tr>
  </table>`;
}

export function renderTransactionalBodyCopy(value: string) {
  return `<p style="margin:24px 0 0;color:#4f504b;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7">${escapeTransactionalEmailHtml(value)}</p>`;
}

export function renderFrameTransactionalEmail(input: {
  origin: string;
  subject: string;
  preheader: string;
  headerLabel: string;
  headerMarker?: TransactionalEmailMarker;
  eyebrow: string;
  heading: string;
  intro: string;
  bodyHtml?: string;
  cta?: {
    label: string;
    href: string;
  } | null;
  secondaryLink?: {
    label: string;
    href: string;
  } | null;
  footerNote: string;
  footerLinks?: TransactionalEmailLink[];
}) {
  const safeOrigin = escapeTransactionalEmailHtml(input.origin);
  const footerLinks =
    input.footerLinks ??
    [
      { label: "Privacy", href: `${input.origin}/privacy` },
      { label: "Contact", href: `${input.origin}/contact` },
    ];
  const footerLinksHtml = footerLinks
    .map(
      (link) =>
        `<a href="${escapeTransactionalEmailHtml(link.href)}" style="color:#b9b8b1;text-decoration:underline">${escapeTransactionalEmailHtml(link.label)}</a>`,
    )
    .join("&nbsp;&nbsp;&middot;&nbsp;&nbsp;");
  const cta = input.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 0"><tr><td bgcolor="#20211e" style="background:#20211e"><a class="email-button-link" href="${escapeTransactionalEmailHtml(input.cta.href)}" style="display:inline-block;padding:15px 22px;color:#fffdf8;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:.01em;line-height:1.4;text-decoration:none">${escapeTransactionalEmailHtml(input.cta.label)}&nbsp;&nbsp;&rarr;</a></td></tr></table>`
    : "";
  const secondaryLink = input.secondaryLink
    ? `<p style="margin:18px 0 0;color:#5e5e58;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6"><a href="${escapeTransactionalEmailHtml(input.secondaryLink.href)}" style="color:#8d3e46;text-decoration:underline">${escapeTransactionalEmailHtml(input.secondaryLink.label)}</a></p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeTransactionalEmailHtml(input.subject)}</title>
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      table { border-collapse: collapse !important; }
      img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
      @media only screen and (max-width: 620px) {
        .email-outer { padding: 0 !important; }
        .email-card { width: 100% !important; border-left: 0 !important; border-right: 0 !important; }
        .email-header { padding: 24px !important; }
        .email-content { padding: 38px 24px 42px !important; }
        .email-footer { padding: 28px 24px !important; }
        .email-heading { font-size: 36px !important; line-height: 1.03 !important; }
        .email-summary { padding: 24px 20px !important; }
        .email-button-link { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#eee9df;color:#20211e">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px">${escapeTransactionalEmailHtml(input.preheader)}&#847;&nbsp;&zwnj;&nbsp;&#847;&nbsp;&zwnj;&nbsp;&#847;&nbsp;&zwnj;&nbsp;&#847;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eee9df" style="width:100%;background:#eee9df">
      <tr>
        <td class="email-outer" align="center" style="padding:40px 16px">
          <table class="email-card" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#fffdf8" style="width:100%;max-width:600px;background:#fffdf8;border:1px solid #dcd6cc">
            <tr><td height="5" bgcolor="#8d3e46" style="height:5px;background:#8d3e46;font-size:0;line-height:0">&nbsp;</td></tr>
            <tr>
              <td class="email-header" style="padding:25px 42px;border-bottom:1px solid #e5dfd5">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" valign="middle"><a href="${safeOrigin}" style="color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;letter-spacing:-1px;line-height:1;text-decoration:none">Frame<span style="color:#8d3e46">.</span></a></td>
                    <td align="right" valign="middle" style="color:#66645e;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:.12em;line-height:1.4;text-transform:uppercase">${markerHtml(input.headerMarker ?? "arrow")}${escapeTransactionalEmailHtml(input.headerLabel)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:50px 42px 48px">
                <p style="margin:0 0 15px;color:#8d3e46;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;line-height:1.4;text-transform:uppercase">${escapeTransactionalEmailHtml(input.eyebrow)}</p>
                <h1 class="email-heading" style="margin:0;color:#20211e;font-family:Georgia,'Times New Roman',serif;font-size:44px;font-weight:400;letter-spacing:-1.3px;line-height:1.04">${escapeTransactionalEmailHtml(input.heading)}</h1>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:25px 0 25px"><tr><td width="42" height="2" bgcolor="#8d3e46" style="width:42px;height:2px;background:#8d3e46;font-size:0;line-height:0">&nbsp;</td></tr></table>
                <p style="margin:0;color:#4f504b;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7">${escapeTransactionalEmailHtml(input.intro)}</p>
                ${input.bodyHtml ?? ""}
                ${cta}
                ${secondaryLink}
              </td>
            </tr>
            <tr>
              <td class="email-footer" bgcolor="#20211e" style="padding:30px 42px;background:#20211e;color:#b9b8b1;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.7">
                <p style="margin:0 0 11px;color:#fffdf8;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1">Frame<span style="color:#bd6871">.</span></p>
                <p style="margin:0 0 8px">Questions? <a href="mailto:support@framewearable.com" style="color:#fffdf8;text-decoration:underline">support@framewearable.com</a></p>
                <p style="margin:0">${footerLinksHtml}</p>
                <p style="margin:14px 0 0;color:#8f8f89">${escapeTransactionalEmailHtml(input.footerNote)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
