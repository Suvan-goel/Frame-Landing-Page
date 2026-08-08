export const dynamic = "force-dynamic";

const CONTACT_EMAIL = "support@framewearable.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 16_384;
const MAX_MESSAGE_LENGTH = 3000;

const TOPIC_LABELS = new Map([
  ["general", "General question"],
  ["preorder", "Pre-order support"],
  ["research", "Research or engineering"],
  ["partnerships", "Partnership or press"],
  ["privacy", "Privacy or data request"],
  ["other", "Something else"],
]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanSingleLine(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanMessage(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Your message is too large." }, 413);
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return jsonResponse({ error: "Request origin is not allowed." }, 403);
  }

  let payload: {
    name?: unknown;
    email?: unknown;
    topic?: unknown;
    message?: unknown;
    website?: unknown;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonResponse({ error: "Complete every contact form field." }, 400);
  }

  if (typeof payload.website === "string" && payload.website.trim()) {
    return jsonResponse({ sent: true }, 201);
  }

  const name = cleanSingleLine(payload.name, 100);
  const email = cleanSingleLine(payload.email, 254).toLowerCase();
  const topic = typeof payload.topic === "string" ? payload.topic : "";
  const message = cleanMessage(payload.message);

  if (name.length < 2) {
    return jsonResponse({ error: "Enter your name." }, 400);
  }
  if (!EMAIL_PATTERN.test(email) || email.includes("..")) {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }
  const topicLabel = TOPIC_LABELS.get(topic);
  if (!topicLabel) {
    return jsonResponse({ error: "Choose what you’d like to discuss." }, 400);
  }
  if (!message) {
    return jsonResponse({ error: "Enter a message." }, 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return jsonResponse(
      { error: `Keep your message to ${MAX_MESSAGE_LENGTH} characters or fewer.` },
      400,
    );
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return jsonResponse(
      { error: "Contact email is temporarily unavailable. Please try again later." },
      503,
    );
  }

  const fromEmail =
    process.env.CONTACT_FROM_EMAIL?.trim() ||
    "Frame Website <website@framewearable.com>";
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeTopic = escapeHtml(topicLabel);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [CONTACT_EMAIL],
        reply_to: email,
        subject: `Frame contact: ${topicLabel} — ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nTopic: ${topicLabel}\n\n${message}`,
        html: `<h2>New Frame website message</h2><p><strong>Name:</strong> ${safeName}<br><strong>Email:</strong> ${safeEmail}<br><strong>Topic:</strong> ${safeTopic}</p><p>${safeMessage}</p>`,
      }),
    });

    if (!response.ok) {
      return jsonResponse(
        { error: "We couldn’t send your message. Please try again." },
        502,
      );
    }

    return jsonResponse({ sent: true }, 201);
  } catch {
    return jsonResponse(
      { error: "We couldn’t send your message. Please try again." },
      502,
    );
  }
}
