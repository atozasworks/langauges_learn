const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const { MongoClient } = require("mongodb");

dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.PORT || 3000);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const MONGODB_DB = process.env.MONGODB_DB || process.env.MONGODB_DATABASE || "lldb";
const NODE_ENV = process.env.NODE_ENV || "development";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

let mongoClient = null;
let dbInstance = null;
let smtpTransporter = null;
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

  const host = process.env.SMTP_SERVER;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE || "true").toLowerCase() === "true";
  const user = process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return smtpTransporter;
}

async function sendOtpEmail(email, otp) {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    return { delivered: false, reason: "SMTP is not configured" };
  }

  const fromName = process.env.SMTP_NAME || "LAN Learn";
  const fromAddress = process.env.SMTP_EMAIL;

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: email,
    subject: "Your LAN Learn OTP Code",
    text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    html: `<p>Your OTP is <strong>${otp}</strong>.</p><p>This OTP expires in 5 minutes.</p>`,
  });

  return { delivered: true };
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

app.options(/.*/, cors());

app.post(["/api/send-otp", "/auth-backend/send-otp.php"], async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    if (!isEmailValid(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address." });
    }

    const otp = crypto.randomInt(0, 10000).toString().padStart(4, "0");
    await saveOtpCode(email, otp, 300);

    const mailResult = await sendOtpEmail(email, otp);
    const responsePayload = {
      success: true,
      message: mailResult.delivered
        ? "OTP sent successfully to your email."
        : "OTP generated successfully. SMTP is not configured, check server logs.",
    };

    if (!mailResult.delivered && NODE_ENV !== "production") {
      responsePayload.dev_otp = otp;
      responsePayload.note = "Development mode only";
      // Log OTP to simplify local testing when SMTP is not configured.
      console.log(`[DEV OTP] ${email}: ${otp}`);
    }

    return res.json(responsePayload);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP. Please try again.",
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

    if (!/^\d{4}$/.test(otp)) {
      return res.status(400).json({ success: false, message: "OTP must be exactly 4 digits." });
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
    await getDb();
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
  process.exit(0);
});

start();
