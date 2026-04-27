import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VoiceResponse =
  twilio.twiml.VoiceResponse;

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

const sessions =
  new Map();

function getSession(callSid) {

  if (!sessions.has(callSid)) {

    sessions.set(callSid, {
      name: "IVR User",
      date: "",
      time: "",
      retries: 0
    });

  }

  return sessions.get(callSid);

}

/* =============================
   DATABASE SAVE
============================= */

async function saveAppointment(data) {

  try {

    console.log(
      "Sending to API:",
      data
    );

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

app.post("/call", async (
  req,
  res
) => {

  try {

    console.log(
      "Call request:",
      req.body
    );

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

    console.log(
      "Call SID:",
      call.sid
    );

    res.json({
      success: true,
      callSid:
        call.sid
    });

  }

  catch (error) {

    console.error(
      "CALL ERROR:",
      error.message
    );

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

app.post("/twiml", (
  req,
  res
) => {

  const twiml =
    new VoiceResponse();

  const gather =
    twiml.gather({

      input: "dtmf",

      numDigits: 1,

      timeout: 7,

      actionOnEmptyResult: true,

      method: "POST",

      action:
        `${process.env.PUBLIC_URL}/menu`

    });

  gather.say(
    {
      voice:
        "Polly.Aditi",
      language:
        "hi-IN"
    },
    "नमस्ते। अपॉइंटमेंट बुक करने के लिए एक दबाएं।"
  );

  res.type("text/xml");
  res.send(
    twiml.toString()
  );

});

/* =============================
   STEP 2 — DATE SELECTION
============================= */

app.post("/menu", (
  req,
  res
) => {

  const twiml =
    new VoiceResponse();

  const digit =
    req.body.Digits;

  if (digit !== "1") {

    twiml.say(
      {
        voice:
          "Polly.Aditi",
        language:
          "hi-IN"
      },
      "गलत विकल्प। कृपया फिर से प्रयास करें।"
    );

    twiml.redirect(
      `${process.env.PUBLIC_URL}/twiml`
    );

    res.type("text/xml");
    res.send(
      twiml.toString()
    );

    return;

  }

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
      voice:
        "Polly.Aditi",
      language:
        "hi-IN"
    },
    message
  );

  res.type("text/xml");
  res.send(
    twiml.toString()
  );

});

/* =============================
   STEP 3 — SAVE DATE
============================= */

app.post("/get-date", (
  req,
  res
) => {

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

  if (
    isNaN(digit) ||
    digit < 1 ||
    digit > 7
  ) {

    twiml.say(
      {
        voice:
          "Polly.Aditi",
        language:
          "hi-IN"
      },
      "गलत तारीख चुनी गई।"
    );

    twiml.redirect(
      `${process.env.PUBLIC_URL}/menu`
    );

    res.type("text/xml");
    res.send(
      twiml.toString()
    );

    return;

  }

  const d =
    new Date();

  d.setDate(
    d.getDate() +
      digit -
      1
  );

  session.date =
    d
      .toISOString()
      .split("T")[0];

  console.log(
    "Selected date:",
    session.date
  );

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
      voice:
        "Polly.Aditi",
      language:
        "hi-IN"
    },
    "समय चुनें। दस बजे के लिए एक दबाएं। ग्यारह तीस के लिए दो दबाएं। दो बजे के लिए तीन दबाएं। चार तीस के लिए चार दबाएं।"
  );

  res.type("text/xml");
  res.send(
    twiml.toString()
  );

});

/* =============================
   STEP 4 — TIME + SAVE
============================= */

app.post("/get-time", async (
  req,
  res
) => {

  const twiml =
    new VoiceResponse();

  const session =
    getSession(
      req.body.CallSid
    );

  const digit =
    req.body.Digits;

  const times = {
    1: "10:00 AM",
    2: "11:30 AM",
    3: "2:00 PM",
    4: "4:30 PM"
  };

  if (!times[digit]) {

    twiml.say(
      {
        voice:
          "Polly.Aditi",
        language:
          "hi-IN"
      },
      "गलत समय चुना गया।"
    );

    twiml.redirect(
      `${process.env.PUBLIC_URL}/get-date`
    );

    res.type("text/xml");
    res.send(
      twiml.toString()
    );

    return;

  }

  session.time =
    times[digit];

  console.log(
    "Saving appointment:",
    session
  );

  await saveAppointment(
    session
  );

  twiml.say(
    {
      voice:
        "Polly.Aditi",
      language:
        "hi-IN"
    },
    `आपका अपॉइंटमेंट ${session.date} को ${session.time} के लिए बुक हो गया है। धन्यवाद।`
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
   HEALTH CHECK
============================= */

app.get("/", (
  req,
  res
) => {

  res.send(
    "IVR Running"
  );

});

/* =============================
   START SERVER
============================= */

const PORT =
  process.env.PORT ||
  8080;

app.listen(
  PORT,
  () => {

    console.log(
      "Server running on port",
      PORT
    );

  }
);
