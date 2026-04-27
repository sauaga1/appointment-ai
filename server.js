/*
Single File: server.js
Hindi + Hinglish Smart Conversation Voice Agent
Works with Twilio IVR and saves appointment to database API

Required Environment Variables:
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxx
PUBLIC_URL=https://your-domain.up.railway.app
APPOINTMENT_API_URL=https://yourdomain.com/save_appointment.php
PORT=8080
*/

import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";
import fetch from "node-fetch";

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
// Step 1: Greeting + Intent
// =============================
app.post("/twiml", (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: "speech",
    language: "hi-IN",
    action: "/intent",
    method: "POST",
    speechTimeout: "auto"
  });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "Namaste ji, main clinic se bol rahi hoon. Kya aap appointment book karna chahte hain?"
  );

  res.type("text/xml");
  res.send(twiml.toString());
});

// =============================
// Step 2: Intent Detection
// =============================
app.post("/intent", (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const speech = (req.body.SpeechResult || "").toLowerCase();

  if (
    speech.includes("haan") ||
    speech.includes("yes") ||
    speech.includes("book") ||
    speech.includes("karna")
  ) {
    const gather = twiml.gather({
      input: "speech",
      language: "hi-IN",
      action: "/get-name",
      method: "POST",
      speechTimeout: "auto"
    });

    gather.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "Theek hai. Kripya apna naam batayein."
    );
  } else {
    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "Theek hai. Dhanyavaad."
    );

    twiml.hangup();
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

  const gather = twiml.gather({
    input: "speech",
    language: "hi-IN",
    action: "/get-date",
    method: "POST",
    speechTimeout: "auto"
  });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    `Dhanyavaad ${name} ji. Aap kis din appointment lena chahte hain?`
  );

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

  const gather = twiml.gather({
    input: "speech",
    language: "hi-IN",
    action: "/get-time",
    method: "POST",
    speechTimeout: "auto"
  });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    `Theek hai. ${date} ke liye appointment set kar rahe hain. Aap subah aana chahenge ya shaam?`
  );

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
