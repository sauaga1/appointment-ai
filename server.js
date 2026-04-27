import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";
import http from "http";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VoiceResponse = twilio.twiml.VoiceResponse;

/* =============================
   HTTP KEEP ALIVE
============================= */

const agent = new http.Agent({
  keepAlive: true
});

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
      time: "",
      retries: 0
    });

  }

  return sessions.get(callSid);

}

/* =============================
   FAST DATABASE SAVE
============================= */

function saveAppointmentAsync(data) {

  process.nextTick(async () => {

    try {

      const controller =
        new AbortController();

      const timeout =
        setTimeout(() => {
          controller.abort();
        }, 5000);

      await fetch(
        process.env.APPOINTMENT_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          agent,
          keepalive: true,

          signal:
            controller.signal,

          body:
            JSON.stringify(data)
        }
      );

      clearTimeout(timeout);

    } catch (err) {

      console.log(
        "Save failed:",
        err.message
      );

    }

  });

}

/* =============================
   FAST GATHER
============================= */

function fastGather(twiml, url) {

  return twiml.gather({

    input: "speech",

    language: "en-IN",

    bargeIn: true,

    timeout: 1,

    speechTimeout: 1,

    actionOnEmptyResult: true,

    method: "POST",

    action:
      `${process.env.PUBLIC_URL}${url}`

  });

}

/* =============================
   CALL TRIGGER
============================= */

app.post("/call", async (req, res) => {

  try {

    const { to } = req.body;

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
      callSid: call.sid
    });

  }

  catch (error) {

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

  const twiml =
    new VoiceResponse();

  const session =
    getSession(
      req.body.CallSid
    );

  session.retries++;

  if (session.retries > 2) {

    twiml.say(
      "No response received. Kripya dobara call karein."
    );

    twiml.hangup();

    sessions.delete(
      req.body.CallSid
    );

  }

  else {

    const gather =
      fastGather(
        twiml,
        "/intent"
      );

    gather.say(
      "Namaste. Hello. Kya aap appointment book karna chahte hain?"
    );

  }

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

  const session =
    getSession(
      req.body.CallSid
    );

  const speech =
    (req.body.SpeechResult || "")
      .toLowerCase()
      .trim();

  console.log(
    "Intent:",
    speech
  );

  const yesWords = [

    "yes",
    "yeah",
    "book",
    "appointment",
    "schedule",

    "haan",
    "ha",
    "han",
    "karna",
    "book karo",
    "doctor"
  ];

  const noWords = [

    "no",
    "cancel",
    "later",

    "nahi",
    "nahin",
    "baad me",
    "cancel karo"
  ];

  const isYes =
    yesWords.some(word =>
      speech.includes(word)
    );

  const isNo =
    noWords.some(word =>
      speech.includes(word)
    );

  if (isYes) {

    session.retries = 0;

    const gather =
      fastGather(
        twiml,
        "/get-name"
      );

    gather.say(
      "Kripya apna naam batayein."
    );

  }

  else if (isNo) {

    twiml.say(
      "Theek hai. Dhanyavaad."
    );

    twiml.hangup();

    sessions.delete(
      req.body.CallSid
    );

  }

  else {

    session.retries++;

    if (session.retries < 3) {

      const gather =
        fastGather(
          twiml,
          "/intent"
        );

      gather.say(
        "Samajh nahi aaya. Kripya haan ya nahi bolein."
      );

    }

    else {

      twiml.say(
        "No response received. Call ending."
      );

      twiml.hangup();

      sessions.delete(
        req.body.CallSid
      );

    }

  }

  res.type("text/xml");
  res.send(
    twiml.toString()
  );

});

/* =============================
   NAME
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

  const gather =
    fastGather(
      twiml,
      "/get-date"
    );

  gather.say(
    "Kaunsi date par appointment chahte hain?"
  );

  res.type("text/xml");
  res.send(
    twiml.toString()
  );

});

/* =============================
   DATE
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

  const gather =
    fastGather(
      twiml,
      "/get-time"
    );

  gather.say(
    "Samay chuniyega. Das baje, gyarah baje, do baje, ya chaar baje."
  );

  res.type("text/xml");
  res.send(
    twiml.toString()
  );

});

/* =============================
   TIME
============================= */

app.post("/get-time", (req, res) => {

  const twiml =
    new VoiceResponse();

  const session =
    getSession(
      req.body.CallSid
    );

  const speech =
    (req.body.SpeechResult || "")
      .toLowerCase()
      .trim();

  console.log(
    "Time speech:",
    speech
  );

  let selected = null;

  if (
    speech.includes("10") ||
    speech.includes("ten") ||
    speech.includes("das")
  ) {
    selected =
      "10:00 AM";
  }

  else if (
    speech.includes("11") ||
    speech.includes("eleven") ||
    speech.includes("gyarah")
  ) {
    selected =
      "11:30 AM";
  }

  else if (
    speech.includes("2") ||
    speech.includes("two") ||
    speech.includes("do")
  ) {
    selected =
      "2:00 PM";
  }

  else if (
    speech.includes("4") ||
    speech.includes("four") ||
    speech.includes("chaar")
  ) {
    selected =
      "4:30 PM";
  }

  if (selected) {

    session.time =
      selected;

    saveAppointmentAsync(
      session
    );

    twiml.say(
      `Appointment ${selected} par book ho gaya hai. Dhanyavaad.`
    );

    twiml.hangup();

    sessions.delete(
      req.body.CallSid
    );

  }

  else {

    session.retries++;

    if (session.retries < 3) {

      const gather =
        fastGather(
          twiml,
          "/get-time"
        );

      gather.say(
        "Kripya valid time bolein. Jaise das baje, gyarah baje, do baje."
      );

    }

    else {

      twiml.say(
        "Time samajh nahi aaya. Call ending."
      );

      twiml.hangup();

      sessions.delete(
        req.body.CallSid
      );

    }

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
