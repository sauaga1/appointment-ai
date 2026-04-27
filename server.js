/*
Single File: server.js
Fully Fixed Hindi + Hinglish Clinic Voice Agent
- Works with Twilio IVR
- Handles Intent properly (no call cut)
- Uses full PUBLIC_URL in all actions
- Saves appointment to database API
- Includes fallback redirects
- Node 18 compatible (no node-fetch required)

ENV VARIABLES (Railway):
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxx
PUBLIC_URL=https://your-app.up.railway.app
APPOINTMENT_API_URL=https://yourdomain.com/save_appointment.php
PORT=8080
*/

import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";

// Load env
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Health check
app.get("/", (req, res) => {
  res.send("Clinic Voice Agent Running");
});

// =============================
// Trigger Call API
// =============================
app.post("/call", async (req, res) => {
  try {
    const { to } = req.body;

    const call = await client.calls.create({
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${process.env.PUBLIC_URL}/twiml`,
      method: "POST"
    });

    res.json({
      success: true,
      callSid: call.sid
    });
  } catch (error) {
    console.error("Call Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =============================
// Step 1: Greeting
// =============================
app.post("/twiml", (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: "speech",
    language: "hi-IN",
    action: `${process.env.PUBLIC_URL}/intent`,
    method: "POST",
    speechTimeout: 5,
    timeout: 10
  });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "Namaste ji, main Riya bol rahi hoon. Kya aap appointment book karna chahte hain?"
  );

  // fallback repeat
  twiml.redirect(`${process.env.PUBLIC_URL}/twiml`);

  res.type("text/xml");
  res.send(twiml.toString());
});

// =============================
// Step 2: Intent Detection
// =============================
app.post("/intent", (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // Normalize speech (handle Hindi + Hinglish + punctuation)
  const rawSpeech = req.body.SpeechResult || "";
  const speech = rawSpeech
    .toLowerCase()
    .replace(/[!?.]/g, "")
    .trim();

  console.log("Intent speech:", speech);

  // Smart Hinglish + Hindi Intent Detection
  const yesIntents = [
    "haan",
    "haan ji",
    "yes",
    "yeah",
    "yep",
    "book",
    "booking",
    "appointment",
    "karna",
    "karni",
    "kar do",
    "schedule",
    "doctor",
    "milna",
    "dikhana",
    "checkup",
    "consultation",
    "हां",
    "हाँ",
    "हां जी",
    "अपॉइंटमेंट",
    "डॉक्टर",
    "मिलना"
  ];

  const noIntents = [
    "nahin",
    "nahi",
    "no",
    "cancel",
    "baad me",
    "later",
    "zarurat nahi",
    "नहीं",
    "नही",
    "मत"
  ];

  const isYes = yesIntents.some(word => speech.includes(word));
  const isNo = noIntents.some(word => speech.includes(word));

  if (isYes)

  console.log("Intent speech:", speech);

  // Smart Hinglish Intent Detection
  const yesIntents = [
    "haan",
    "haan ji",
    "yes",
    "yeah",
    "yep",
    "book",
    "booking",
    "appointment",
    "karna",
    "karni",
    "kar do",
    "schedule",
    "doctor",
    "milna",
    "dikhana",
    "checkup",
    "consultation"
  ];

  const noIntents = [
    "nahin",
    "nahi",
    "no",
    "cancel",
    "baad me",
    "later",
    "zarurat nahi"
  ];

  const isYes = yesIntents.some(word => speech.includes(word));
  const isNo = noIntents.some(word => speech.includes(word));

  if (isYes) {
    const gather = twiml.gather({
      input: "speech",
      language: "hi-IN",
      action: `${process.env.PUBLIC_URL}/get-name`,
      method: "POST",
      speechTimeout: 5,
      timeout: 10
    });

    gather.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "Theek hai. Kripya apna naam batayein."
    );

    twiml.redirect(`${process.env.PUBLIC_URL}/intent`);
  } else {
    const retry = twiml.gather({
      input: "speech",
      language: "hi-IN",
      action: `${process.env.PUBLIC_URL}/intent`,
      method: "POST",
      speechTimeout: 5,
      timeout: 10
    });

    retry.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "Main samajh nahi payi. Kripya haan ya na bolein."
    );

    twiml.redirect(`${process.env.PUBLIC_URL}/intent`);
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

// =============================
// Step 3: Get Name
// =============================
app.post("/get-name", (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const name = req.body.SpeechResult || "Guest";

  console.log("Name:", name);

  const gather = twiml.gather({
    input: "speech",
    language: "hi-IN",
    action: `${process.env.PUBLIC_URL}/get-date`,
    method: "POST",
    speechTimeout: 5,
    timeout: 10
  });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    `Dhanyavaad ${name} ji. Aap kis din appointment lena chahte hain?`
  );

  twiml.redirect(`${process.env.PUBLIC_URL}/get-name`);

  res.type("text/xml");
  res.send(twiml.toString());
});

// =============================
// Step 4: Get Date
// =============================
app.post("/get-date", (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const date = req.body.SpeechResult || "Kal";

  console.log("Date:", date);

  const gather = twiml.gather({
    input: "speech",
    language: "hi-IN",
    action: `${process.env.PUBLIC_URL}/get-time`,
    method: "POST",
    speechTimeout: 5,
    timeout: 10
  });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    `Theek hai. ${date} ke liye appointment set kar rahe hain. Aap subah aana chahenge ya shaam?`
  );

  twiml.redirect(`${process.env.PUBLIC_URL}/get-date`);

  res.type("text/xml");
  res.send(twiml.toString());
});

// =============================
// Step 5: Save Appointment
// =============================
app.post("/get-time", async (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const time = req.body.SpeechResult || "Subah";

  console.log("Time:", time);

  try {
    await fetch(process.env.APPOINTMENT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Voice Caller",
        age: "Unknown",
        problem: "Voice Booking",
        date: "User Selected",
        time: time
      })
    });

    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "Aapka appointment safalta se book ho gaya hai. Dhanyavaad."
    );
  } catch (error) {
    console.error("Database Error:", error);

    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "Kshama kijiye. Appointment save nahi ho paya."
    );
  }

  twiml.hangup();

  res.type("text/xml");
  res.send(twiml.toString());
});

// =============================
// Start Server
// =============================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
