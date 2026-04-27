import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";
import http from "http";

// Load env

dotenv.config();

const app = express();

/* =============================
   FAST BODY PARSING
============================= */

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const VoiceResponse = twilio.twiml.VoiceResponse;

/* =============================
   TWILIO CLIENT
============================= */

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* =============================
   SESSION STORAGE (FAST IN-MEMORY)
============================= */

const sessions = new Map();

function getSession(callSid) {
  if (!sessions.has(callSid)) {
    sessions.set(callSid, {
      name: "IVR User",
      date: "",
      time: ""
    });
  }

  return sessions.get(callSid);
}

/* =============================
   BACKGROUND SAVE (NON-BLOCKING)
============================= */

async function saveAppointment(data) {
  try {
    if (!process.env.APPOINTMENT_API_URL) return;

    await fetch(process.env.APPOINTMENT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.log("Save error:", err.message);
    }
  }
}

/* =============================
   CALL TRIGGER
============================= */

app.post("/call", async (req, res) => {
  try {
    const { to } = req.body;

    const call = await client.calls.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${process.env.PUBLIC_URL}/twiml`,
      method: "POST"
    });

    res.json({
      success: true,
      callSid: call.sid
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =============================
   STEP 1 — GREETING
============================= */

app.post("/twiml", (req, res) => {
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: "dtmf",
    numDigits: 1,
    timeout: 3,
    speechTimeout: "auto",
    actionOnEmptyResult: true,
    action: `${process.env.PUBLIC_URL}/menu`,
    method: "POST"
  });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN",
      rate: "fast"
    },
    "नमस्ते। अपॉइंटमेंट बुक करने के लिए एक दबाएं।"
  );

  res.type("text/xml");
  res.send(twiml.toString());
});

/* =============================
   STEP 2 — DATE
============================= */

app.post("/menu", (req, res) => {
  const twiml = new VoiceResponse();

  const digit = req.body.Digits;

  if (digit !== "1") {
    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN",
        rate: "fast"
      },
      "गलत विकल्प।"
    );

    twiml.redirect(`${process.env.PUBLIC_URL}/twiml`);

    res.type("text/xml");
    res.send(twiml.toString());
    return;
  }

  const gather = twiml.gather({
    input: "dtmf",
    numDigits: 2,
    timeout: 3,
    speechTimeout: "auto",
    actionOnEmptyResult: true,
    finishOnKey: "#",
    action: `${process.env.PUBLIC_URL}/get-date`
  });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN",
      rate: "fast"
    },
    "कृपया तारीख टाइप करें और हैश दबाएं।"
  );

  res.type("text/xml");
  res.send(twiml.toString());
});

/* =============================
   SAVE DATE
============================= */

app.post("/get-date", (req, res) => {
  const twiml = new VoiceResponse();

  const session = getSession(req.body.CallSid);

  const input = parseInt(req.body.Digits);

  if (isNaN(input) || input < 1 || input > 31) {
    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN",
        rate: "fast"
      },
      "गलत तारीख।"
    );

    twiml.redirect(`${process.env.PUBLIC_URL}/menu`);

    res.type("text/xml");
    res.send(twiml.toString());
    return;
  }

  const today = new Date();

  const selectedDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    input
  );

  session.date = selectedDate
    .toISOString()
    .split("T")[0];

  if (process.env.NODE_ENV !== "production") {
    console.log("DATE:", session.date);
  }

  const gather = twiml.gather({
    input: "dtmf",
    timeout: 3,
    speechTimeout: "auto",
    actionOnEmptyResult: true,
    finishOnKey: "#",
    action: `${process.env.PUBLIC_URL}/get-time`
  });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN",
      rate: "fast"
    },
    "समय टाइप करें और हैश दबाएं।"
  );

  res.type("text/xml");
  res.send(twiml.toString());
});

/* =============================
   SAVE TIME + THANK YOU
============================= */

app.post("/get-time", (req, res) => {
  const twiml = new VoiceResponse();

  const session = getSession(req.body.CallSid);

  const input = req.body.Digits;

  let selected = null;

  if (input === "10") selected = "10:00 AM";
  else if (input === "1030") selected = "10:30 AM";
  else if (input === "11") selected = "11:00 AM";
  else if (input === "1130") selected = "11:30 AM";
  else if (input === "12") selected = "12:00 PM";
  else if (input === "1230") selected = "12:30 PM";
  else if (input === "1") selected = "1:00 PM";

  if (selected) {
    session.time = selected;

    if (process.env.NODE_ENV !== "production") {
      console.log("FINAL:", session);
    }

    /* ULTRA FAST BACKGROUND SAVE */

    process.nextTick(() => {
      saveAppointment(session);
    });

    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN",
        rate: "fast"
      },
      `आपका अपॉइंटमेंट ${session.date} को ${session.time} के लिए बुक हो गया है।`
    );

    twiml.pause({ length: 1 });

    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN",
        rate: "fast"
      },
      "धन्यवाद। आपका दिन शुभ हो।"
    );

    twiml.hangup();

    sessions.delete(req.body.CallSid);
  } else {
    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN",
        rate: "fast"
      },
      "गलत समय। फिर से दर्ज करें।"
    );

    twiml.redirect(`${process.env.PUBLIC_URL}/get-date`);
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

/* =============================
   HEALTH CHECK
============================= */

app.get("/", (req, res) => {
  res.send("Ultra Fast IVR Running");
});

/* =============================
   ULTRA FAST SERVER (KEEP-ALIVE)
============================= */

const PORT = process.env.PORT || 8080;

const server = http.createServer(app);

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

server.listen(PORT, () => {
  console.log("Ultra Fast IVR running on port", PORT);
});
