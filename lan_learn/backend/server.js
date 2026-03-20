const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');

require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const DEBUG_EMAIL_STATUS = String(process.env.DEBUG_EMAIL_STATUS || 'false') === 'true';
const SMTP_VERIFY_ON_START = String(process.env.SMTP_VERIFY_ON_START || 'false') === 'true';

const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

app.use(cors({
  origin: corsOrigins.length ? corsOrigins : true,
}));
app.use(express.json());

const otpStore = new Map();
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID || undefined);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.atozas.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || 'true') === 'true',
  auth: {
    user: process.env.SMTP_USER || 'no-reply@atozas.com',
    pass: process.env.SMTP_PASS || '',
  },
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').toLowerCase());
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function cleanupExpiredOtps() {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (record.expiresAt <= now) {
      otpStore.delete(email);
    }
  }
}

setInterval(cleanupExpiredOtps, 60_000).unref();

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'auth-service' });
});

app.post('/auth/send-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (!process.env.SMTP_PASS) {
      return res.status(500).json({ error: 'SMTP_PASS is not configured in backend .env.' });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + OTP_TTL_MINUTES * 60 * 1000;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@atozas.com',
      to: email,
      subject: 'Your OTP Code',
      text: `Your one-time OTP is ${otp}. It is valid for ${OTP_TTL_MINUTES} minutes.`,
      html: `<p>Your one-time OTP is <b>${otp}</b>.</p><p>This code is valid for ${OTP_TTL_MINUTES} minutes.</p>`,
    });

    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];

    if (DEBUG_EMAIL_STATUS) {
      console.log('send-otp smtp status:', {
        to: email,
        accepted,
        rejected,
        messageId: info.messageId,
        response: info.response,
      });
    }

    if (accepted.length === 0 || rejected.length > 0) {
      return res.status(502).json({
        error: 'SMTP did not accept the recipient address. Please verify the email and mailbox settings.',
      });
    }

    otpStore.set(email, { otp, expiresAt });

    const response = { message: 'OTP sent to your email address.' };

    if (String(process.env.DEBUG_SHOW_OTP || 'false') === 'true') {
      response.debugOtp = otp;
    }

    return res.json(response);
  } catch (error) {
    console.error('send-otp error:', error);
    return res.status(500).json({ error: 'Unable to send OTP email. Please try again.' });
  }
});

app.post('/auth/verify-otp', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '').trim();

  if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Email or OTP format is invalid.' });
  }

  const record = otpStore.get(email);
  if (!record) {
    return res.status(400).json({ error: 'No OTP request found for this email.' });
  }

  if (record.expiresAt < Date.now()) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  if (record.otp !== otp) {
    return res.status(401).json({ error: 'OTP does not match.' });
  }

  otpStore.delete(email);
  return res.json({
    message: 'OTP verified successfully.',
    user: { email, provider: 'otp' },
  });
});

app.post('/auth/google-login', async (req, res) => {
  try {
    const credential = String(req.body?.credential || '').trim();

    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required.' });
    }

    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not configured in backend .env.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Invalid Google token payload.' });
    }

    return res.json({
      message: 'Google login successful.',
      user: {
        provider: 'google',
        sub: payload.sub,
        email: payload.email,
        name: payload.name || '',
        picture: payload.picture || '',
        emailVerified: Boolean(payload.email_verified),
      },
    });
  } catch (error) {
    console.error('google-login error:', error);
    return res.status(401).json({ error: 'Google token verification failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`Auth service running on http://localhost:${PORT}`);

  if (SMTP_VERIFY_ON_START) {
    transporter
      .verify()
      .then(() => {
        console.log('SMTP connection verified successfully.');
      })
      .catch((error) => {
        console.error('SMTP verification failed:', error?.message || error);
      });
  }
});
