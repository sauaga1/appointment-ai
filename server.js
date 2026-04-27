import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VoiceResponse = twilio.twiml.VoiceResponse;

/* =============================
   TWILIO CLIENT
============================= */

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* =============================
   SESSION STORAGE
============================= */

const sessions = new Map();

function getSession(callSid) {

  if (!sessions.has(callSid)) {

    sessions.set(callSid, {
      name: "",
      date: "",
      time: ""
    });

  }

  return sessions.get(callSid);

}

/* =============================
   DATABASE SAVE
============================= */

async function saveAppointment(data) {

  try {

    await fetch(
      process.env.APPOINTMENT_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body:
          JSON.stringify(data)
      }
    );

    console.log(
      "Appointment saved"
    );

  }

  catch (err) {

    console.log(
      "Save error:",
      err.message
    );

  }

}

/* =============================
   CALL TRIGGER
============================= */

app.post("/call", async (req, res) => {

  try {

    const { to } =
      req.body;

    const call =
      await client.calls.create({

        to,

        from:
          process.env
            .TWILIO_PHONE_NUMBER,

        url:
          `${process.env.PUBLIC_URL}/twiml`,

        method: "POST"

      });

    res.json({
      success: true,
      callSid:
        call.sid
    });

  }

  catch (error) {

    res.status(500).json({
      success: false,
      error:
        error.message
    });

  }

});

/* =============================
   STEP 1 — GREETING
============================= */

app.post("/twiml", (req, res) => {

  const twiml =
    new VoiceResponse();

  const gather =
    twiml.gather({

      input: "speech",

      language: "hi-IN",

      timeout: 5,

      speechTimeout: "auto",

      actionOnEmptyResult: true,

      method: "POST",

      action:
        `${process.env.PUBLIC_URL}/intent`

    });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "नमस्ते। क्या आप अपॉइंटमेंट बुक करना चाहते हैं?"
  );

  res.type("text/xml");

  res.send(
    twiml.toString()
  );

});

/* =============================
   STEP 2 — INTENT
============================= */

app.post("/intent", (req, res) => {

  const twiml =
    new VoiceResponse();

  const speech =
    (req.body.SpeechResult || "")
      .toLowerCase();

  console.log(
    "Intent speech:",
    speech
  );

  const yesWords = [
    "हाँ",
    "haan",
    "ha",
    "करना",
    "बुक"
  ];

  const isYes =
    yesWords.some(word =>
      speech.includes(word)
    );

  if (isYes) {

    const gather =
      twiml.gather({

        input: "speech",

        language: "hi-IN",

        timeout: 5,

        speechTimeout: "auto",

        method: "POST",

        action:
          `${process.env.PUBLIC_URL}/get-name`

      });

    gather.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "कृपया अपना नाम बताइए।"
    );

  }

  else {

    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "ठीक है। धन्यवाद।"
    );

    twiml.hangup();

  }

  res.type("text/xml");

  res.send(
    twiml.toString()
  );

});

/* =============================
   STEP 3 — NAME
============================= */

app.post("/get-name", (req, res) => {

  const twiml =
    new VoiceResponse();

  const session =
    getSession(
      req.body.CallSid
    );

  session.name =
    req.body.SpeechResult ||
    "Guest";

  console.log(
    "Name:",
    session.name
  );

  const gather =
    twiml.gather({

      input: "speech",

      language: "hi-IN",

      timeout: 5,

      speechTimeout: "auto",

      method: "POST",

      action:
        `${process.env.PUBLIC_URL}/get-date`

    });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "कृपया तारीख बताइए।"
  );

  res.type("text/xml");

  res.send(
    twiml.toString()
  );

});

/* =============================
   STEP 4 — DATE
============================= */

app.post("/get-date", (req, res) => {

  const twiml =
    new VoiceResponse();

  const session =
    getSession(
      req.body.CallSid
    );

  session.date =
    req.body.SpeechResult ||
    "Tomorrow";

  console.log(
    "Date:",
    session.date
  );

  const gather =
    twiml.gather({

      input: "speech",

      language: "hi-IN",

      timeout: 5,

      speechTimeout: "auto",

      method: "POST",

      action:
        `${process.env.PUBLIC_URL}/get-time`

    });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "कृपया समय चुनें। दस बजे, ग्यारह तीस बजे, दो बजे, या चार तीस बजे।"
  );

  res.type("text/xml");

  res.send(
    twiml.toString()
  );

});

/* =============================
   STEP 5 — TIME + SAVE
============================= */

app.post("/get-time", async (req, res) => {

  const twiml =
    new VoiceResponse();

  const session =
    getSession(
      req.body.CallSid
    );

  const speech =
    (req.body.SpeechResult || "")
      .toLowerCase();

  let selected = null;

  if (speech.includes("10") || speech.includes("दस"))
    selected = "10:00 AM";

  else if (speech.includes("11") || speech.includes("ग्यारह"))
    selected = "11:30 AM";

  else if (speech.includes("2") || speech.includes("दो"))
    selected = "2:00 PM";

  else if (speech.includes("4") || speech.includes("चार"))
    selected = "4:30 PM";

  if (selected) {

    session.time = selected;

    console.log(
      "Saving:",
      session
    );

    await saveAppointment(
      session
    );

    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      `आपका अपॉइंटमेंट ${selected} के लिए बुक हो गया है। धन्यवाद।`
    );

    twiml.hangup();

    sessions.delete(
      req.body.CallSid
    );

  }

  else {

    const gather =
      twiml.gather({

        input: "speech",

        language: "hi-IN",

        timeout: 5,

        speechTimeout: "auto",

        method: "POST",

        action:
          `${process.env.PUBLIC_URL}/get-time`

      });

    gather.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "कृपया सही समय बोलें।"
    );

  }

  res.type("text/xml");

  res.send(
    twiml.toString()
  );

});

/* =============================
   START SERVER
============================= */

const PORT =
  process.env.PORT || 8080;

app.listen(PORT, () => {

  console.log(
    "Server running on port",
    PORT
  );

});
