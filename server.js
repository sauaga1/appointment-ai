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
   HTTP KEEP ALIVE (FASTER)
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
   SESSION STORAGE (PER CALL)
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
   FAST ASYNC DATABASE SAVE
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

      if (
        process.env.DEBUG ===
        "true"
      ) {
        console.log(
          "Save failed:",
          err.message
        );
      }

    }

  });

}

/* =============================
   ULTRA FAST GATHER TEMPLATE
============================= */

function fastGather(
  twiml,
  url
) {

  return twiml.gather({

    input: "speech",

    language: "en-US",

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
   HEALTH CHECK
============================= */

app.get("/", (req, res) => {

  res.send(
    "Voice Agent Running"
  );

});

/* =============================
   CALL TRIGGER
============================= */

app.post(
  "/call",
  async (req, res) => {

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

    } catch (error) {

      res.status(500).json({
        success: false,
        error:
          error.message
      });

    }

  }
);

/* =============================
   STEP 1 — GREETING
============================= */

app.post(
  "/twiml",
  (req, res) => {

    const twiml =
      new VoiceResponse();

    const gather =
      fastGather(
        twiml,
        "/intent"
      );

    gather.say(
      {
        voice:
          "Polly.Joanna"
      },
      "Hello. Would you like to book an appointment?"
    );

    res.type("text/xml");
    res.send(
      twiml.toString()
    );

  }
);

/* =============================
   STEP 2 — INTENT
============================= */

app.post(
  "/intent",
  (req, res) => {

    const twiml =
      new VoiceResponse();

    const speech =
      (
        req.body
          .SpeechResult ||
        ""
      )
        .toLowerCase()
        .trim();

    const yesWords = [
      "yes",
      "book",
      "appointment",
      "schedule"
    ];

    const noWords = [
      "no",
      "cancel",
      "later"
    ];

    const isYes =
      yesWords.some(w =>
        speech.includes(w)
      );

    const isNo =
      noWords.some(w =>
        speech.includes(w)
      );

    if (isYes) {

      const gather =
        fastGather(
          twiml,
          "/get-name"
        );

      gather.say(
        {
          voice:
            "Polly.Joanna"
        },
        "Please tell me your name."
      );

    }

    else if (isNo) {

      twiml.say(
        {
          voice:
            "Polly.Joanna"
        },
        "Okay. Thank you."
      );

      twiml.hangup();

    }

    else {

      twiml.redirect(
        `${process.env.PUBLIC_URL}/twiml`
      );

    }

    res.type("text/xml");
    res.send(
      twiml.toString()
    );

  }
);

/* =============================
   STEP 3 — NAME
============================= */

app.post(
  "/get-name",
  (req, res) => {

    const twiml =
      new VoiceResponse();

    const session =
      getSession(
        req.body.CallSid
      );

    session.name =
      req.body
        .SpeechResult ||
      "Guest";

    const gather =
      fastGather(
        twiml,
        "/get-date"
      );

    gather.say(
      {
        voice:
          "Polly.Joanna"
      },
      "Which date would you like?"
    );

    res.type("text/xml");
    res.send(
      twiml.toString()
    );

  }
);

/* =============================
   STEP 4 — DATE
============================= */

app.post(
  "/get-date",
  (req, res) => {

    const twiml =
      new VoiceResponse();

    const session =
      getSession(
        req.body.CallSid
      );

    session.date =
      req.body
        .SpeechResult ||
      "Tomorrow";

    const gather =
      fastGather(
        twiml,
        "/get-time"
      );

    gather.say(
      {
        voice:
          "Polly.Joanna"
      },
      "Choose time. Ten AM, eleven thirty AM, two PM, or four thirty PM."
    );

    res.type("text/xml");
    res.send(
      twiml.toString()
    );

  }
);

/* =============================
   STEP 5 — TIME + SAVE
============================= */

app.post(
  "/get-time",
  (req, res) => {

    const twiml =
      new VoiceResponse();

    const session =
      getSession(
        req.body.CallSid
      );

    const speech =
      (
        req.body
          .SpeechResult ||
        ""
      )
        .toLowerCase()
        .trim();

    const slots = [
      "10:00 am",
      "11:30 am",
      "2:00 pm",
      "4:30 pm"
    ];

    let selected =
      null;

    for (
      let slot of slots
    ) {

      if (
        speech.includes(
          slot
        ) ||
        speech.includes(
          slot.replace(
            ":00",
            ""
          )
        )
      ) {

        selected =
          slot;

        break;

      }

    }

    if (selected) {

      session.time =
        selected;

      saveAppointmentAsync(
        session
      );

      twiml.say(
        {
          voice:
            "Polly.Joanna"
        },
        "Appointment booked. Thank you."
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
          "/get-time"
        );

      gather.say(
        {
          voice:
            "Polly.Joanna"
        },
        "Please choose valid time."
      );

    }

    res.type("text/xml");
    res.send(
      twiml.toString()
    );

  }
);

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
