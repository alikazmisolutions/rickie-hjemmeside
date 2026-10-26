// Sends the contact form through Simply.com's own mail server as rw@rwent.dk, so the
// message arrives as ordinary mail from the company's own address instead of from a
// shared form service that Simply's spam filter tends to stop.
// Needs two environment variables in Vercel: SMTP_USER (rw@rwent.dk) and SMTP_PASS.
const nodemailer = require('nodemailer');

const TO = 'rw@rwent.dk';
const ALLOWED_ORIGINS = ['https://www.rwent.dk', 'https://rwent.dk'];
const LIMIT = { name: 120, phone: 40, email: 160, topic: 60, address: 200, message: 4000 };
const recent = new Map(); // best-effort rate limit per IP while the function stays warm

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

module.exports = async (req, res) => {
  const configured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

  // GET tells the page (and us) whether direct sending is set up, without revealing anything else
  if (req.method === 'GET') return res.status(200).json({ ok: true, configured });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  const origin = req.headers.origin || '';
  if (origin && !ALLOWED_ORIGINS.includes(origin) && !origin.endsWith('.vercel.app')) {
    return res.status(403).json({ ok: false, error: 'origin' });
  }
  if (!configured) return res.status(503).json({ ok: false, error: 'not_configured' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (hits.length >= 5) return res.status(429).json({ ok: false, error: 'rate' });
  recent.set(ip, [...hits, now]);

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (b.botcheck) return res.status(200).json({ ok: true }); // honeypot: pretend success, send nothing

  const f = {};
  for (const k of Object.keys(LIMIT)) f[k] = clean(b[k], LIMIT[k]);
  if (!f.name || !f.phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  const rows = [
    ['Navn', f.name], ['Telefon', f.phone], ['E-mail', f.email], ['Opgave', f.topic || '–'],
    ['Adresse', f.address || '–'], ['Beskrivelse', f.message || '–'],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n\nSendt fra formularen på rwent.dk. Svar direkte på denne mail for at skrive til kunden.';
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a">
    <h2 style="margin:0 0 16px;font-size:20px">Ny forespørgsel: ${esc(f.topic || 'Tilbud')}</h2>
    <table cellpadding="8" style="border-collapse:collapse">${rows.map(([k, v]) =>
      `<tr><td style="color:#666;vertical-align:top;border-bottom:1px solid #eee">${k}</td><td style="border-bottom:1px solid #eee;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table>
    <p style="color:#888;font-size:13px;margin-top:18px">Sendt fra formularen på rwent.dk. Svar direkte på denne mail for at skrive til kunden.</p></div>`;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.simply.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // fail fast so the visitor isn't left waiting and the page can fall back to Web3Forms
      connectionTimeout: 6000, greetingTimeout: 5000, socketTimeout: 8000,
    });
    await transporter.sendMail({
      from: `"rwent.dk" <${process.env.SMTP_USER}>`,
      to: TO,
      replyTo: `"${f.name.replace(/"/g, '')}" <${f.email}>`,
      subject: `Tilbud: ${f.topic || 'Forespørgsel'} – ${f.name}`,
      text,
      html,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send failed:', err && err.code, err && err.responseCode, err && err.message);
    return res.status(502).json({ ok: false, error: 'smtp' });
  }
};
