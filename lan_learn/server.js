const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const { MongoClient } = require("mongodb");
const mongoose = require("mongoose");
const { createAuthRouter, createRequireAuth } = require("atozas-auth-kit-express");

dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.PORT || 3000);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const MONGODB_DB = process.env.MONGODB_DB || process.env.MONGODB_DATABASE || "lldb";
const NODE_ENV = process.env.NODE_ENV || "development";
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const JWT_SECRET = String(process.env.JWT_SECRET || (NODE_ENV === "production" ? "" : "dev-jwt-secret-change-me"));
const JWT_REFRESH_SECRET = String(
  process.env.JWT_REFRESH_SECRET || (NODE_ENV === "production" ? "" : "dev-jwt-refresh-secret-change-me")
);
const FRONTEND_URL = String(process.env.FRONTEND_URL || "").trim();
const OTP_LENGTH = Number(process.env.OTP_LENGTH || 6);
const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 300);

const app = express();

const allowedOrigins = FRONTEND_URL
  ? FRONTEND_URL.split(",").map((origin) => origin.trim()).filter(Boolean)
  : true;

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

let mongoClient = null;
let dbInstance = null;
let smtpTransporter = null;
let smtpVerified = false;
let otpSchemaMigrated = false;

function isEmailValid(email) {
  if (typeof email !== "string") {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function toTitleCase(name) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  mongoClient = new MongoClient(MONGODB_URI, {
    ignoreUndefined: true,
  });

  await mongoClient.connect();
  dbInstance = mongoClient.db(MONGODB_DB);
  await ensureIndexes(dbInstance);
  await ensureOtpSchema(dbInstance);
  return dbInstance;
}

async function ensureMongooseConnection() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(MONGODB_URI, {
    dbName: MONGODB_DB,
  });
}

function assertAuthConfiguration() {
  const missing = [];

  if (!JWT_SECRET) {
    missing.push("JWT_SECRET");
  }

  if (!JWT_REFRESH_SECRET) {
    missing.push("JWT_REFRESH_SECRET");
  }

  if (NODE_ENV === "production" && !GOOGLE_CLIENT_ID) {
    missing.push("GOOGLE_CLIENT_ID");
  }

  if (missing.length > 0) {
    throw new Error(`Missing auth configuration: ${missing.join(", ")}`);
  }

  if (!GOOGLE_CLIENT_ID) {
    console.warn("[AUTH CONFIG] GOOGLE_CLIENT_ID is not set. Google login will be unavailable.");
  }

  if (JWT_SECRET === "dev-jwt-secret-change-me" || JWT_REFRESH_SECRET === "dev-jwt-refresh-secret-change-me") {
    console.warn("[AUTH CONFIG] Using development JWT secrets. Set JWT_SECRET and JWT_REFRESH_SECRET in .env.");
  }
}

function createAuthKitConfig() {
  return {
    googleClientId: GOOGLE_CLIENT_ID || "missing-google-client-id",
    jwtSecret: JWT_SECRET,
    jwtRefreshSecret: JWT_REFRESH_SECRET,
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || "15m",
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || "30d",
    otpExpiry: Math.max(1, Math.ceil(OTP_TTL_SECONDS / 60)),
    otpLength: OTP_LENGTH,
    otpRateLimit: {
      maxAttempts: Number(process.env.OTP_RATE_LIMIT_ATTEMPTS || 3),
      windowMs: Number(process.env.OTP_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    },
    cookieOptions: {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    frontendUrl: FRONTEND_URL || undefined,
    sendEmailOtp: async (to, otp) => {
      const mailResult = await sendOtpEmail(to, otp);
      if (!mailResult.delivered) {
        if (NODE_ENV !== "production" && mailResult.reason === "SMTP is not configured") {
          console.warn(`[DEV OTP] email=${to} otp=${otp}`);
          return;
        }

        throw new Error(mailResult.reason || "Failed to deliver OTP email");
      }
    },
  };
}

async function ensureOtpSchema(db) {
  if (otpSchemaMigrated) {
    return;
  }

  const otpCodes = db.collection("otp_codes");

  // Legacy `otp_hash` values are one-way hashes; keep them unusable and normalize schema.
  await otpCodes.updateMany(
    { otp: { $exists: false }, otp_hash: { $exists: true }, used_at: null },
    { $set: { used_at: new Date() } }
  );

  await otpCodes.updateMany(
    { otp: { $exists: false }, otp_hash: { $exists: true } },
    {
      $set: { otp: null, migrated_at: new Date() },
      $unset: { otp_hash: "" },
    }
  );

  otpSchemaMigrated = true;
}

async function ensureIndexes(db) {
  const learningTeam = db.collection("learning_team");
  const otpCodes = db.collection("otp_codes");
  const loginAudit = db.collection("login_audit");

  const hasKeyIndex = (indexes, keySpec) => {
    const serialized = JSON.stringify(keySpec);
    return indexes.some((idx) => JSON.stringify(idx.key) === serialized);
  };

  const ltIndexes = await learningTeam.indexes();
  if (!hasKeyIndex(ltIndexes, { user_email: 1, learner_name: 1 })) {
    await learningTeam.createIndex({ user_email: 1, learner_name: 1 }, { unique: true });
  }
  if (!hasKeyIndex(ltIndexes, { user_email: 1, created_at: 1 })) {
    await learningTeam.createIndex({ user_email: 1, created_at: 1 });
  }
  if (!hasKeyIndex(ltIndexes, { id: 1 })) {
    await learningTeam.createIndex({ id: 1 }, { unique: true });
  }

  const otpIndexes = await otpCodes.indexes();
  if (!hasKeyIndex(otpIndexes, { email: 1, created_at: -1 })) {
    await otpCodes.createIndex({ email: 1, created_at: -1 });
  }
  if (!hasKeyIndex(otpIndexes, { email: 1, otp: 1, used_at: 1, created_at: -1 })) {
    await otpCodes.createIndex({ email: 1, otp: 1, used_at: 1, created_at: -1 });
  }

  const auditIndexes = await loginAudit.indexes();
  if (!hasKeyIndex(auditIndexes, { email: 1, created_at: -1 })) {
    await loginAudit.createIndex({ email: 1, created_at: -1 });
  }
}

async function getNextCounterValue(key) {
  const db = await getDb();
  const counters = db.collection("counters");
  const updateResult = await counters.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    {
      upsert: true,
      returnDocument: "after",
    }
  );

  const doc = updateResult?.value || updateResult;
  if (!doc || typeof doc.seq !== "number") {
    throw new Error(`Failed to increment counter: ${key}`);
  }

  return doc.seq;
}

function getSmtpTransporter() {
  if (smtpTransporter) {
    return smtpTransporter;
  }

  const service = process.env.SMTP_SERVICE || "";
  const host = process.env.SMTP_SERVER || process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || (port === 465 ? "true" : "false")).toLowerCase() === "true";
  const user = process.env.SMTP_EMAIL || process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || process.env.SMTP_APP_PASSWORD;
  const requireTLS = String(process.env.SMTP_REQUIRE_TLS || "false").toLowerCase() === "true";
  const rejectUnauthorized = String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true").toLowerCase() === "true";

  if ((!service && !host) || !user || !pass) {
    return null;
  }

  const smtpConfig = {
    auth: {
      user,
      pass,
    },
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
    requireTLS,
    tls: {
      servername: host || undefined,
      rejectUnauthorized,
    },
  };

  if (service) {
    smtpTransporter = nodemailer.createTransport({
      service,
      secure,
      ...smtpConfig,
    });
  } else {
    smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...smtpConfig,
    });
  }

  return smtpTransporter;
}

async function sendOtpEmail(email, otp) {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    return { delivered: false, reason: "SMTP is not configured" };
  }

  if (!smtpVerified) {
    await transporter.verify();
    smtpVerified = true;
  }

  const fromName = process.env.SMTP_NAME || "LAN Learn";
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_EMAIL;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: email,
    envelope: {
      from: fromAddress,
      to: email,
    },
    subject: "Login OTP",
    text: `Your OTP for login is: ${otp}`,
    html: `<p>Your OTP for login is: <strong>${otp}</strong></p>`,
  });

  const accepted = Array.isArray(info.accepted) ? info.accepted : [];
  const rejected = Array.isArray(info.rejected) ? info.rejected : [];
  const pending = Array.isArray(info.pending) ? info.pending : [];
  const delivered = accepted.length > 0 && rejected.length === 0;

  if (delivered) {
    console.log(
      `[OTP EMAIL SENT] to=${email} messageId=${info.messageId || "n/a"} accepted=${accepted.join(",")}`
    );
  } else {
    console.warn(
      `[OTP EMAIL FAILED] to=${email} accepted=${accepted.join(",")} rejected=${rejected.join(",")} pending=${pending.join(",")} response=${
        info.response || "n/a"
      }`
    );
  }

  return {
    delivered,
    reason: delivered ? null : "SMTP server did not accept recipient",
    accepted,
    rejected,
    pending,
    messageId: info.messageId || null,
    response: info.response || null,
  };
}

async function saveLoginAudit(req, rec) {
  const db = await getDb();
  await db.collection("login_audit").insertOne({
    email: rec.email || "",
    login_method: rec.login_method || "unknown",
    provider_user_id: rec.provider_user_id || null,
    display_name: rec.display_name || null,
    login_status: rec.login_status || "success",
    client_ip: getClientIp(req),
    user_agent: req.headers["user-agent"] || null,
    created_at: new Date(),
  });
}

async function saveOtpCode(email, otp, ttlSeconds) {
  const db = await getDb();
  const otpCol = db.collection("otp_codes");

  await otpCol.updateMany(
    { email, used_at: null },
    { $set: { used_at: new Date() } }
  );

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await otpCol.insertOne({
    email,
    otp,
    expires_at: expiresAt,
    used_at: null,
    created_at: new Date(),
  });
}

async function invalidateOtpCode(email, otp) {
  const db = await getDb();
  const otpCol = db.collection("otp_codes");

  await otpCol.findOneAndUpdate(
    { email, otp, used_at: null },
    { $set: { used_at: new Date() } },
    { sort: { created_at: -1 }, returnDocument: "after" }
  );
}

async function verifyOtpCode(email, otp) {
  const db = await getDb();
  const otpCol = db.collection("otp_codes");

  const doc = await otpCol.findOne(
    { email, otp, used_at: null },
    { sort: { created_at: -1 } }
  );

  if (!doc) {
    return false;
  }

  if (!doc.expires_at || new Date(doc.expires_at).getTime() < Date.now()) {
    return false;
  }

  await otpCol.updateOne(
    { _id: doc._id, used_at: null },
    { $set: { used_at: new Date() } }
  );

  return true;
}

function localDebugPayload(req, err) {
  const ip = getClientIp(req);
  const isLocalIp = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  if (!isLocalIp) {
    return {};
  }

  return {
    error_detail: err?.message || "Unknown error",
  };
}

function isLocalRequest(req) {
  const ip = getClientIp(req);
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function isSmtpDebugAllowed(req) {
  return NODE_ENV !== "production" || isLocalRequest(req);
}

function getSmtpConfigSummary() {
  const service = (process.env.SMTP_SERVICE || "").trim();
  const host = (process.env.SMTP_SERVER || process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || (port === 465 ? "true" : "false")).toLowerCase() === "true";
  const user = (process.env.SMTP_EMAIL || process.env.SMTP_USER || "").trim();
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || process.env.SMTP_APP_PASSWORD || "";
  const fromAddress = (process.env.SMTP_FROM || process.env.SMTP_EMAIL || process.env.SMTP_USER || "").trim();
  const requireTLS = String(process.env.SMTP_REQUIRE_TLS || "false").toLowerCase() === "true";
  const rejectUnauthorized = String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true").toLowerCase() === "true";

  const missing = [];
  if (!service && !host) {
    missing.push("SMTP_SERVER or SMTP_HOST or SMTP_SERVICE");
  }
  if (!user) {
    missing.push("SMTP_EMAIL or SMTP_USER");
  }
  if (!pass) {
    missing.push("SMTP_PASSWORD or SMTP_PASS or SMTP_APP_PASSWORD");
  }
  if (!fromAddress) {
    missing.push("SMTP_FROM or SMTP_EMAIL");
  }

  return {
    configured: missing.length === 0,
    service: service || null,
    host: host || null,
    port,
    secure,
    user: user || null,
    fromAddress: fromAddress || null,
    requireTLS,
    rejectUnauthorized,
    hasPassword: Boolean(pass),
    missing,
  };
}

const authKitConfig = createAuthKitConfig();
const requireAuth = createRequireAuth(authKitConfig);

app.options(/.*/, cors(corsOptions));

app.get("/api/auth/config", (req, res) => {
  return res.json({
    success: true,
    apiUrl: "/api/auth",
    googleClientId: GOOGLE_CLIENT_ID || null,
    googleEnabled: Boolean(GOOGLE_CLIENT_ID),
  });
});

app.use("/api/auth", createAuthRouter(authKitConfig));

app.post(["/api/send-otp", "/auth-backend/send-otp.php"], async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!isEmailValid(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }

    const otp = crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
    await saveOtpCode(email, otp, OTP_TTL_SECONDS);

    const mailResult = await sendOtpEmail(email, otp);
    if (!mailResult.delivered) {
      await invalidateOtpCode(email, otp);
      return res.status(502).json({
        success: false,
        message: "OTP email delivery failed. Please check email address or SMTP setup.",
        ...(NODE_ENV !== "production"
          ? {
              dev_otp: otp,
              mail_debug: {
                reason: mailResult.reason || "unknown",
                accepted: mailResult.accepted || [],
                rejected: mailResult.rejected || [],
                pending: mailResult.pending || [],
                response: mailResult.response || null,
              },
            }
          : {}),
      });
    }

    const responsePayload = {
      success: true,
      message: "OTP sent successfully to your email.",
    };

    return res.json(responsePayload);
  } catch (err) {
    console.error("[OTP SEND ERROR]", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP. Please try again.",
      ...(NODE_ENV !== "production" ? { smtp_error: err?.message || "Unknown SMTP error" } : {}),
      ...localDebugPayload(req, err),
    });
  }
});

app.post(["/api/verify-otp", "/auth-backend/verify-otp.php"], async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    const otp = String(req.body?.otp || "").trim();

    if (!isEmailValid(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }

    const otpRegex = new RegExp(`^\\d{${OTP_LENGTH}}$`);
    if (!otpRegex.test(otp)) {
      return res.status(400).json({ success: false, message: `OTP must be exactly ${OTP_LENGTH} digits.` });
    }

    const verified = await verifyOtpCode(email, otp);
    if (!verified) {
      return res.status(401).json({ success: false, message: "Invalid or expired OTP." });
    }

    await saveLoginAudit(req, {
      email,
      login_method: "otp",
      provider_user_id: null,
      display_name: null,
      login_status: "success",
    });

    return res.json({ success: true, message: "OTP verified. Login successful." });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "OTP verification failed.",
      ...localDebugPayload(req, err),
    });
  }
});

app.post(["/api/save-google-login", "/auth-backend/save-google-login.php"], async (req, res) => {
  try {
    const accessToken = String(req.body?.accessToken || "").trim();
    if (!accessToken) {
      return res.status(400).json({ success: false, message: "Access token is required." });
    }

    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return res.status(401).json({ success: false, message: "Failed to verify Google token." });
    }

    const profile = await response.json();
    const email = String(profile.email || "").trim();
    const name = String(profile.name || "").trim();
    const sub = String(profile.sub || "").trim();

    if (!isEmailValid(email) || !sub) {
      return res.status(401).json({ success: false, message: "Invalid Google user profile." });
    }

    await saveLoginAudit(req, {
      email,
      login_method: "google",
      provider_user_id: sub,
      display_name: name || null,
      login_status: "success",
    });

    return res.json({
      success: true,
      message: "Google login saved successfully.",
      user: {
        email,
        name,
        sub,
        picture: profile.picture || "",
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Google login failed.",
      ...localDebugPayload(req, err),
    });
  }
});

app.get("/api/secure/learners", requireAuth, async (req, res) => {
  try {
    const email = String(req.user?.email || "").trim().toLowerCase();
    if (!isEmailValid(email)) {
      return res.status(401).json({ success: false, message: "Invalid authenticated user." });
    }

    const db = await getDb();
    const docs = await db
      .collection("learning_team")
      .find({ user_email: email })
      .sort({ created_at: 1, id: 1 })
      .toArray();

    const learners = docs.map((doc) => ({
      id: Number(doc.id),
      name: doc.learner_name,
    }));

    return res.json({ success: true, learners });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error.",
      ...localDebugPayload(req, err),
    });
  }
});

app.post("/api/secure/learners", requireAuth, async (req, res) => {
  try {
    const email = String(req.user?.email || "").trim().toLowerCase();
    const name = String(req.body?.name || "").trim();

    if (!isEmailValid(email)) {
      return res.status(401).json({ success: false, message: "Invalid authenticated user." });
    }

    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: "Learner name must be at least 2 characters." });
    }

    const formattedName = toTitleCase(name);
    const db = await getDb();
    const newId = await getNextCounterValue("learning_team_id");

    await db.collection("learning_team").insertOne({
      id: newId,
      user_email: email,
      learner_name: formattedName,
      created_at: new Date(),
    });

    return res.json({
      success: true,
      message: `${formattedName} added to your learning team.`,
      learner: {
        id: newId,
        name: formattedName,
      },
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This learner already exists in your team.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error.",
      ...localDebugPayload(req, err),
    });
  }
});

app.delete("/api/secure/learners/:learnerId", requireAuth, async (req, res) => {
  try {
    const email = String(req.user?.email || "").trim().toLowerCase();
    const learnerId = Number(req.params?.learnerId || 0);

    if (!isEmailValid(email)) {
      return res.status(401).json({ success: false, message: "Invalid authenticated user." });
    }

    if (!Number.isInteger(learnerId) || learnerId <= 0) {
      return res.status(400).json({ success: false, message: "Valid learner_id is required." });
    }

    const db = await getDb();
    const result = await db.collection("learning_team").deleteOne({
      id: learnerId,
      user_email: email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Learner not found or does not belong to you.",
      });
    }

    return res.json({ success: true, message: "Learner removed from your team." });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error.",
      ...localDebugPayload(req, err),
    });
  }
});

app.get(["/api/get-learners", "/auth-backend/get-learners.php"], async (req, res) => {
  try {
    const email = String(req.query?.email || "").trim();
    if (!isEmailValid(email)) {
      return res.status(400).json({ success: false, message: "Valid email parameter is required." });
    }

    const db = await getDb();
    const docs = await db
      .collection("learning_team")
      .find({ user_email: email })
      .sort({ created_at: 1, id: 1 })
      .toArray();

    const learners = docs.map((doc) => ({
      id: Number(doc.id),
      name: doc.learner_name,
    }));

    return res.json({ success: true, learners });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error.",
      ...localDebugPayload(req, err),
    });
  }
});

app.post(["/api/add-learner", "/auth-backend/add-learner.php"], async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    const name = String(req.body?.name || "").trim();

    if (!isEmailValid(email)) {
      return res.status(400).json({ success: false, message: "Valid email is required." });
    }

    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: "Learner name must be at least 2 characters." });
    }

    const formattedName = toTitleCase(name);
    const db = await getDb();
    const newId = await getNextCounterValue("learning_team_id");

    await db.collection("learning_team").insertOne({
      id: newId,
      user_email: email,
      learner_name: formattedName,
      created_at: new Date(),
    });

    return res.json({
      success: true,
      message: `${formattedName} added to your learning team.`,
      learner: {
        id: newId,
        name: formattedName,
      },
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This learner already exists in your team.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error.",
      ...localDebugPayload(req, err),
    });
  }
});

app.post(["/api/delete-learner", "/auth-backend/delete-learner.php"], async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    const learnerId = Number(req.body?.learner_id || 0);

    if (!isEmailValid(email)) {
      return res.status(400).json({ success: false, message: "Valid email is required." });
    }

    if (!Number.isInteger(learnerId) || learnerId <= 0) {
      return res.status(400).json({ success: false, message: "Valid learner_id is required." });
    }

    const db = await getDb();
    const result = await db.collection("learning_team").deleteOne({
      id: learnerId,
      user_email: email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Learner not found or does not belong to you.",
      });
    }

    return res.json({ success: true, message: "Learner removed from your team." });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error.",
      ...localDebugPayload(req, err),
    });
  }
});

app.get(["/api/smtp-health", "/auth-backend/smtp-health.php"], async (req, res) => {
  if (!isSmtpDebugAllowed(req)) {
    return res.status(403).json({ success: false, message: "SMTP health endpoint is disabled." });
  }

  const smtp = getSmtpConfigSummary();
  if (!smtp.configured) {
    return res.status(200).json({
      success: false,
      message: "SMTP is not fully configured.",
      smtp,
    });
  }

  try {
    const transporter = getSmtpTransporter();
    if (!transporter) {
      return res.status(200).json({
        success: false,
        message: "SMTP transporter is not configured.",
        smtp,
      });
    }

    await transporter.verify();
    smtpVerified = true;

    return res.json({
      success: true,
      message: "SMTP verification successful.",
      smtp,
    });
  } catch (err) {
    smtpVerified = false;
    return res.status(502).json({
      success: false,
      message: "SMTP verification failed.",
      smtp,
      ...(NODE_ENV !== "production" ? { smtp_error: err?.message || "Unknown SMTP error" } : {}),
      ...localDebugPayload(req, err),
    });
  }
});

app.post(["/api/smtp-health", "/auth-backend/smtp-health.php"], async (req, res) => {
  if (!isSmtpDebugAllowed(req)) {
    return res.status(403).json({ success: false, message: "SMTP health endpoint is disabled." });
  }

  const testEmail = String(req.body?.email || "").trim().toLowerCase();
  if (!isEmailValid(testEmail)) {
    return res.status(400).json({ success: false, message: "Valid email is required for SMTP test." });
  }

  const smtp = getSmtpConfigSummary();
  if (!smtp.configured) {
    return res.status(200).json({
      success: false,
      message: "SMTP is not fully configured.",
      smtp,
    });
  }

  try {
    const transporter = getSmtpTransporter();
    if (!transporter) {
      return res.status(200).json({
        success: false,
        message: "SMTP transporter is not configured.",
        smtp,
      });
    }

    await transporter.verify();
    smtpVerified = true;

    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_NAME || "LAN Learn"}" <${smtp.fromAddress}>`,
      to: testEmail,
      envelope: {
        from: smtp.fromAddress,
        to: testEmail,
      },
      subject: "SMTP Health Check",
      text: `SMTP health check successful at ${new Date().toISOString()}`,
      html: `<p>SMTP health check successful at <strong>${new Date().toISOString()}</strong></p>`,
    });

    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    const pending = Array.isArray(info.pending) ? info.pending : [];
    const delivered = accepted.length > 0 && rejected.length === 0;

    if (!delivered) {
      return res.status(502).json({
        success: false,
        message: "SMTP test email was not accepted by server.",
        smtp,
        result: {
          accepted,
          rejected,
          pending,
          response: info.response || null,
          messageId: info.messageId || null,
        },
      });
    }

    return res.json({
      success: true,
      message: "SMTP test email sent successfully.",
      smtp,
      result: {
        accepted,
        rejected,
        pending,
        response: info.response || null,
        messageId: info.messageId || null,
      },
    });
  } catch (err) {
    smtpVerified = false;
    return res.status(502).json({
      success: false,
      message: "SMTP test email failed.",
      smtp,
      ...(NODE_ENV !== "production" ? { smtp_error: err?.message || "Unknown SMTP error" } : {}),
      ...localDebugPayload(req, err),
    });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    await getDb();
    return res.json({
      success: true,
      message: "Node backend is running with MongoDB.",
      mongoDb: MONGODB_DB,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "MongoDB connection failed.",
      ...localDebugPayload(req, err),
    });
  }
});

app.use((req, res, next) => {
  if (req.path.endsWith(".php")) {
    return res.status(404).json({ success: false, message: "Endpoint not found." });
  }
  return next();
});

app.use(express.static(__dirname));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

async function start() {
  try {
    assertAuthConfiguration();
    await Promise.all([getDb(), ensureMongooseConnection()]);
    app.listen(PORT, () => {
      console.log(`LAN Learn Node server running at http://localhost:${PORT}`);
      console.log(`MongoDB database: ${MONGODB_DB}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  if (mongoClient) {
    await mongoClient.close();
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  process.exit(0);
});

start();
