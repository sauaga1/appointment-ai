import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VoiceResponse = twilio.twiml.VoiceResponse;

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* =============================
   FAST NON-BLOCKING SAVE
============================= */

function saveAppointmentAsync(data) {
  setImmediate(async () => {
    try {
      console.log("Saving appointment:", data);

      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, 5000);

      const response = await fetch(
        process.env.APPOINTMENT_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          signal: controller.signal,

          body: JSON.stringify({
            name: data.name,
            date: data.date,
            time: data.time
          })
        }
      );

      clearTimeout(timeout);

      const result = await response.text();

      console.log("Database response:", result);

    } catch (err) {

      console.log(
        "Save failed:",
        err.message
      );

    }
  });
}

/* =============================
   HEALTH
============================= */

app.get("/", (req, res) => {
  res.send("Clinic Voice Agent Running");
});

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
    console.error("Call Error:", error);

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
    input: "speech",
    language: "hi-IN",

    action: `${process.env.PUBLIC_URL}/intent`,

    method: "POST",

    timeout: 3,
    speechTimeout: "auto",

    actionOnEmptyResult: true
  });

  gather.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "Namaste ji, main Riya bol rahi hoon. Kya aap appointment book karna chahte hain?"
  );

  res.type("text/xml");
  res.send(twiml.toString());
});

/* =============================
   STEP 2 — INTENT
============================= */

app.post("/intent", (req, res) => {

  console.time("INTENT_FLOW");

  const twiml = new VoiceResponse();

  const speech = (
    req.body.SpeechResult || ""
  )
    .toLowerCase()
    .replace(/[!?.]/g, "")
    .trim();

  console.log("Intent:", speech);

  const yesIntents = [
    "haan",
    "yes",
    "appointment",
    "book",
    "doctor",
    "milna",
    "checkup",
    "consultation",
    "हां",
    "अपॉइंटमेंट"
  ];

  const noIntents = [
    "nahi",
    "no",
    "cancel",
    "later",
    "नहीं"
  ];

  const isYes =
    yesIntents.some(w =>
      speech.includes(w)
    );

  const isNo =
    noIntents.some(w =>
      speech.includes(w)
    );

  if (isYes) {

    const gather = twiml.gather({
      input: "speech",

      language: "hi-IN",

      action: `${process.env.PUBLIC_URL}/get-name`,

      method: "POST",

      timeout: 3,
      speechTimeout: "auto",

      actionOnEmptyResult: true
    });

    gather.say(
      {
        voice: "Polly.Aditi"
      },
      "Theek hai. Kripya apna naam batayein."
    );

  }

  else if (isNo) {

    twiml.say(
      {
        voice: "Polly.Aditi"
      },
      "Theek hai. Dhanyavaad."
    );

    twiml.hangup();

  }

  else {

    twiml.say(
      {
        voice: "Polly.Aditi"
      },
      "Kripya haan ya na bolein."
    );

    twiml.redirect(
      `${process.env.PUBLIC_URL}/twiml`
    );

  }

  console.timeEnd("INTENT_FLOW");

  res.type("text/xml");
  res.send(twiml.toString());
});

/* =============================
   STEP 3 — NAME
============================= */

app.post("/get-name", (req, res) => {

  const twiml = new VoiceResponse();

  const name =
    req.body.SpeechResult || "Guest";

  console.log("Name:", name);

  const gather = twiml.gather({
    input: "speech",

    language: "hi-IN",

    action: `${process.env.PUBLIC_URL}/get-date`,

    method: "POST",

    timeout: 3,
    speechTimeout: "auto",

    actionOnEmptyResult: true
  });

  gather.say(
    {
      voice: "Polly.Aditi"
    },
    `Dhanyavaad ${name} ji. Aap kis din appointment lena chahte hain?`
  );

  res.type("text/xml");
  res.send(twiml.toString());
});

/* =============================
   STEP 4 — DATE
============================= */

app.post("/get-date", (req, res) => {

  const twiml = new VoiceResponse();

  const date =
    req.body.SpeechResult || "Kal";

  console.log("Date:", date);

  const gather = twiml.gather({
    input: "speech",

    language: "hi-IN",

    action: `${process.env.PUBLIC_URL}/get-time`,

    method: "POST",

    timeout: 3,
    speechTimeout: "auto",

    actionOnEmptyResult: true
  });

  gather.say(
    {
      voice: "Polly.Aditi"
    },
    `Theek hai. ${date} ke liye appointment set kar rahe hain. Aap subah aana chahenge ya shaam?`
  );

  res.type("text/xml");
  res.send(twiml.toString());
});

/* =============================
   STEP 5 — TIME + SAVE
============================= */

app.post("/get-time", (req, res) => {

  console.time("FINAL_FLOW");

  const twiml = new VoiceResponse();

  const time =
    req.body.SpeechResult || "Subah";

  console.log("Time:", time);

  // FAST — do not block voice response
  saveAppointmentAsync(time);

  twiml.say(
    {
      voice: "Polly.Aditi"
    },
    "Aapka appointment safalta se book ho gaya hai. Dhanyavaad."
  );

  twiml.hangup();

  console.timeEnd("FINAL_FLOW");

  res.type("text/xml");
  res.send(twiml.toString());
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
