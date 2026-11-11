import { config } from "../config.js";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

type Transport = (e: Email) => Promise<void>;

/** Resend (https://resend.com): one HTTPS call, no SDK. */
const resend: Transport = async (e) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.emailFrom, to: [e.to], subject: e.subject, html: e.html, text: e.text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${(await res.text()).slice(0, 300)}`);
};

/** Development without RESEND_API_KEY: print the email so links can be clicked from the terminal. */
const consoleTransport: Transport = async (e) => {
  console.log(`\n── Email (dev, not sent) ──────────────────\nTo: ${e.to}\nSubject: ${e.subject}\n\n${e.text}\n───────────────────────────────────────────\n`);
};

let transport: Transport = config.resendApiKey ? resend : consoleTransport;

/** Tests swap in a capturing transport. */
export const setEmailTransport = (t: Transport) => (transport = t);

/** Fire-and-forget so response timing never reveals whether an email was sent. Failures are logged. */
export function sendEmail(e: Email) {
  transport(e).catch((err) => console.error(`Email to ${e.to} failed:`, (err as Error).message));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, intro: string, button: string, link: string, outro: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#050505;font-family:Inter,Arial,sans-serif;color:#d9d4ca">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:480px;background:#0d0d0d;border:1px solid #242424;border-radius:16px;padding:28px">
<tr><td style="font-size:22px;font-weight:700;color:#fff;letter-spacing:.5px">StarkFit<span style="color:#f5b525">IQ</span></td></tr>
<tr><td style="padding-top:20px;font-size:18px;font-weight:600;color:#fff">${esc(title)}</td></tr>
<tr><td style="padding-top:10px;font-size:14px;line-height:1.6">${esc(intro)}</td></tr>
<tr><td style="padding:24px 0"><a href="${esc(link)}" style="display:inline-block;background:#f5b525;color:#050505;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px">${esc(button)}</a></td></tr>
<tr><td style="font-size:12px;line-height:1.6;color:#8f8a80">${esc(outro)}<br><br>Or paste this link into your browser:<br><span style="word-break:break-all">${esc(link)}</span></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${title}\n\n${intro}\n\n${button}: ${link}\n\n${outro}`;
  return { html, text };
}

export function verificationEmail(to: string, name: string, token: string): Email {
  const link = `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: "Verify your StarkFitIQ email",
    ...layout(`Welcome, ${name}`, "Confirm this is your email address to start using StarkFitIQ.", "Verify email", link, "This link expires in 24 hours. If you didn't create an account, you can ignore this email."),
  };
}

export function resetEmail(to: string, name: string, token: string): Email {
  const link = `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: "Reset your StarkFitIQ password",
    ...layout(`Hi ${name}`, "Someone (hopefully you) asked to reset your StarkFitIQ password.", "Choose a new password", link, "This link works once and expires in 1 hour. If you didn't ask for this, ignore this email: your password stays the same."),
  };
}

export function passwordChangedEmail(to: string, name: string): Email {
  const link = `${config.appUrl}/forgot-password`;
  return {
    to,
    subject: "Your StarkFitIQ password was changed",
    ...layout(`Hi ${name}`, "Your password was just changed and all other devices were signed out.", "Wasn't you? Reset it now", link, "If you made this change, no action is needed."),
  };
}
