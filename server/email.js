import nodemailer from "nodemailer";

function hasResend() {
  return Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL);
}

function hasDiscord() {
  return Boolean(process.env.DISCORD_WEBHOOK_URL);
}

function isSmtpConfigured() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL } = process.env;
  return Boolean(
    SMTP_HOST &&
      SMTP_USER &&
      SMTP_PASS &&
      SMTP_PASS !== "your-app-password" &&
      NOTIFY_EMAIL
  );
}

function getBaseUrl() {
  return process.env.BASE_URL || "http://localhost:3000";
}

function buildNotificationContent(application) {
  const baseUrl = getBaseUrl();
  const adminLink = `${baseUrl}/admin/#/application/${application.id}`;
  const answers = application.answers || {};
  const preview = [
    ["Discord", application.discordName],
    ["IC ime", application.icName],
    ["ONIX iskustvo", answers.q3 || "—"],
    ["Dnevna aktivnost", truncate(answers.q4, 120)],
    ["PD iskustvo", truncate(answers.q5, 120)],
    ["Sedmična dostupnost", truncate(answers.q26, 120)],
  ];

  const previewRows = preview
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 0;color:#8b90a5;vertical-align:top;width:140px;">${escapeHtml(label)}</td><td style="padding:8px 0;">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;background:#07070b;color:#f4f6fb;padding:24px;">
      <div style="max-width:620px;margin:0 auto;background:#12121a;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(168,85,247,.15);color:#d8b4fe;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:12px;">ONIX Roleplay</div>
        <h2 style="margin:0 0 8px;color:#a855f7;">Nova prijava — Chief of Police</h2>
        <p style="color:#8b90a5;margin:0 0 20px;">Staff obavijest · ${escapeHtml(application.createdAt || "")}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${previewRows}</table>
        <p style="margin:16px 0 0;font-size:12px;color:#8b90a5;">ID prijave: ${application.id}</p>
        <p style="margin:24px 0 0;">
          <a href="${adminLink}" style="display:inline-block;background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
            Otvori punu prijavu u admin panelu
          </a>
        </p>
      </div>
    </div>
  `;

  const text = [
    "Nova Chief PD prijava — ONIX Roleplay",
    "",
    ...preview.map(([label, value]) => `${label}: ${value}`),
    "",
    `ID: ${application.id}`,
    `Admin: ${adminLink}`,
  ].join("\n");

  const subject = `[ONIX] Nova Chief PD prijava — ${application.discordName}`;

  return { adminLink, html, text, subject, preview };
}

export async function verifyEmailConfig() {
  if (hasResend()) return { ok: true, to: process.env.NOTIFY_EMAIL, via: "resend" };
  if (hasDiscord()) return { ok: true, to: process.env.NOTIFY_EMAIL, via: "discord" };

  if (!isSmtpConfigured()) {
    return {
      ok: false,
      reason:
        "Nema Resend, Discord webhook ni SMTP. Postavi RESEND_API_KEY ili DISCORD_WEBHOOK_URL na Renderu.",
    };
  }

  try {
    const transport = getSmtpTransporter();
    await transport.verify();
    return { ok: true, to: process.env.NOTIFY_EMAIL, via: "smtp" };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export async function sendNewApplicationEmail(application) {
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!notifyEmail) {
    console.warn("[notify] NOTIFY_EMAIL nije postavljen.");
    return { sent: false, reason: "no_notify_email" };
  }

  const content = buildNotificationContent(application);
  const results = [];

  if (hasResend()) {
    results.push(await sendViaResend(application, content));
  }

  if (hasDiscord()) {
    results.push(await sendViaDiscord(application, content));
  }

  // SMTP samo lokalno — Render blokira port 587
  if (isSmtpConfigured() && process.env.NODE_ENV !== "production") {
    results.push(await sendViaSmtp(application, content));
  }

  const sent = results.some((r) => r.sent);
  if (sent) {
    const channels = results.filter((r) => r.sent).map((r) => r.via).join(", ");
    console.log(`[notify] Obavijest poslana (${channels}) — prijava ${application.id}`);
    return { sent: true, channels };
  }

  console.error(`[notify] Nijedan kanal nije poslao obavijest za ${application.id}:`, results);
  return { sent: false, reason: "all_channels_failed", results };
}

async function sendViaResend(application, content) {
  try {
    const from =
      process.env.RESEND_FROM || "ONIX Roleplay <onboarding@resend.dev>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [process.env.NOTIFY_EMAIL],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    return { sent: true, via: "resend" };
  } catch (err) {
    console.error("[notify/resend]", err.message);
    return { sent: false, via: "resend", reason: err.message };
  }
}

async function sendViaDiscord(application, content) {
  try {
    const embed = {
      title: "Nova prijava — Chief of Police",
      color: 0xa855f7,
      fields: content.preview.map(([name, value]) => ({
        name,
        value: String(value).slice(0, 1024) || "—",
        inline: name === "Discord" || name === "IC ime",
      })),
      footer: { text: `ID: ${application.id}` },
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "ONIX Staff — Chief PD",
        content: `**Nova Chief PD prijava**\n<${content.adminLink}>`,
        embeds: [embed],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    return { sent: true, via: "discord" };
  } catch (err) {
    console.error("[notify/discord]", err.message);
    return { sent: false, via: "discord", reason: err.message };
  }
}

async function sendViaSmtp(application, content) {
  try {
    const transport = getSmtpTransporter();
    const from =
      process.env.EMAIL_FROM || `"ONIX Roleplay" <${process.env.SMTP_USER}>`;

    await transport.sendMail({
      from,
      to: process.env.NOTIFY_EMAIL,
      replyTo: process.env.SMTP_USER,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    return { sent: true, via: "smtp" };
  } catch (err) {
    console.error("[notify/smtp]", err.message);
    return { sent: false, via: "smtp", reason: err.message };
  }
}

let smtpTransporter = null;

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS.replace(/\s/g, "") },
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 10000,
  });

  return smtpTransporter;
}

export async function sendTestEmail() {
  const fakeApp = {
    id: "test-" + Date.now(),
    discordName: "test_user#0000",
    icName: "Test Korisnik",
    createdAt: new Date().toISOString(),
    answers: {
      q3: "Test ONIX iskustvo",
      q4: "4 sata dnevno",
      q5: "2 godine PD",
      q26: "40h sedmicno",
    },
  };

  const result = await sendNewApplicationEmail(fakeApp);
  if (result.sent) return { ok: true, to: process.env.NOTIFY_EMAIL, ...result };
  return { ok: false, reason: result.reason || "send_failed", ...result };
}

function truncate(str, max) {
  const s = String(str || "").trim();
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
