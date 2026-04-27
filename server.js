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

    const res =
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
      "DB Response:",
      await res.text()
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
          process.env.TWILIO_PHONE_NUMBER,

        url:
          `${process.env.PUBLIC_URL}/ivr`

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
   STEP 1 — MAIN MENU
============================= */

app.post("/ivr", (req, res) => {

  const twiml =
    new VoiceResponse();

  const gather =
    twiml.gather({

      input: "dtmf",

      numDigits: 1,

      timeout: 7,

      action:
        `${process.env.PUBLIC_URL}/menu`

    });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "नमस्ते। अपॉइंटमेंट बुक करने के लिए 1 दबाएं। कॉल समाप्त करने के लिए 2 दबाएं।"
  );

  res.type("text/xml");

  res.send(
    twiml.toString()
  );

});

/* =============================
   STEP 2 — MENU
============================= */

app.post("/menu", (req, res) => {

  const twiml =
    new VoiceResponse();

  const digit =
    req.body.Digits;

  if (digit === "1") {

    const gather =
      twiml.gather({

        input: "speech",

        language: "hi-IN",

        timeout: 7,

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
      "धन्यवाद।"
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

  /* CREATE DATE MENU */

  let message =
    "कृपया तारीख चुनें। ";

  for (
    let i = 0;
    i < 7;
    i++
  ) {

    const d =
      new Date();

    d.setDate(
      d.getDate() + i
    );

    const text =
      d.toLocaleDateString(
        "hi-IN",
        {
          day: "numeric",
          month: "long"
        }
      );

    message +=
      `${text} के लिए ${
        i + 1
      } दबाएं। `;

  }

  const gather =
    twiml.gather({

      input: "dtmf",

      numDigits: 1,

      timeout: 7,

      action:
        `${process.env.PUBLIC_URL}/get-date`

    });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    message
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

  const digit =
    parseInt(
      req.body.Digits
    );

  const d =
    new Date();

  d.setDate(
    d.getDate() +
    (digit - 1)
  );

  session.date =
    d.toISOString()
      .split("T")[0];

  const gather =
    twiml.gather({

      input: "dtmf",

      numDigits: 1,

      timeout: 7,

      action:
        `${process.env.PUBLIC_URL}/get-time`

    });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "समय चुनें। 1 दबाएं दस बजे के लिए। 2 दबाएं ग्यारह तीस के लिए। 3 दबाएं दो बजे के लिए। 4 दबाएं चार तीस के लिए।"
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

  const digit =
    req.body.Digits;

  if (digit === "1")
    session.time =
      "10:00 AM";

  else if (digit === "2")
    session.time =
      "11:30 AM";

  else if (digit === "3")
    session.time =
      "2:00 PM";

  else if (digit === "4")
    session.time =
      "4:30 PM";

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
    `आपका अपॉइंटमेंट ${session.date} को ${session.time} पर बुक हो गया है। धन्यवाद।`
  );

  twiml.hangup();

  sessions.delete(
    req.body.CallSid
  );

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
    "IVR running on port",
    PORT
  );

});
