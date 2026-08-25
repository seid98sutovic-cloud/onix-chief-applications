import nodemailer from "nodemailer";

let transporter = null;

function isEmailConfigured() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL } = process.env;
  return Boolean(
    SMTP_HOST &&
      SMTP_USER &&
      SMTP_PASS &&
      SMTP_PASS !== "your-app-password" &&
      NOTIFY_EMAIL
  );
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isEmailConfigured()) return null;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS.replace(/\s/g, "") },
    tls: { minVersion: "TLSv1.2" },
  });

  return transporter;
}

export async function verifyEmailConfig() {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      reason: "SMTP nije konfigurisan. Postavi SMTP_USER i SMTP_PASS (Gmail App Password) u .env",
    };
  }

  try {
    const transport = getTransporter();
    await transport.verify();
    return { ok: true, to: process.env.NOTIFY_EMAIL };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export async function sendNewApplicationEmail(application) {
  const transport = getTransporter();
  const notifyEmail = process.env.NOTIFY_EMAIL;
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  if (!transport || !notifyEmail) {
    console.warn("[email] SMTP nije konfigurisan — preskačem email obavijest.");
    return { sent: false, reason: "not_configured" };
  }

  const adminLink = `${baseUrl}/admin/#/application/${application.id}`;
  const from =
    process.env.EMAIL_FROM || `"ONIX Roleplay" <${process.env.SMTP_USER}>`;

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

  await transport.sendMail({
    from,
    to: notifyEmail,
    replyTo: process.env.SMTP_USER,
    subject: `[ONIX] Nova Chief PD prijava — ${application.discordName}`,
    html,
    text,
  });

  console.log(`[email] Obavijest poslana na ${notifyEmail} (prijava ${application.id})`);
  return { sent: true };
}

export async function sendTestEmail() {
  const result = await verifyEmailConfig();
  if (!result.ok) return result;

  const transport = getTransporter();
  const notifyEmail = process.env.NOTIFY_EMAIL;
  const from =
    process.env.EMAIL_FROM || `"ONIX Roleplay" <${process.env.SMTP_USER}>`;

  await transport.sendMail({
    from,
    to: notifyEmail,
    subject: "[ONIX] Test — Chief PD sistem radi",
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;padding:24px;">
        <h2 style="color:#a855f7;">ONIX Chief PD — Email test uspješan</h2>
        <p>Sistem za prijave je spreman. Nove prijave će stizati na ovaj email.</p>
      </div>
    `,
    text: "ONIX Chief PD — Email test uspješan. Sistem je spreman.",
  });

  return { ok: true, to: notifyEmail };
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
