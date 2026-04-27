import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VoiceResponse = twilio.twiml.VoiceResponse;

/* =============================
   TWILIO CLIENT (FIXED)
============================= */

const accountSid =
  process.env.TWILIO_ACCOUNT_SID;

const authToken =
  process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error(
    "Twilio credentials missing in .env"
  );
}

const client = twilio(
  accountSid,
  authToken
);

/* =============================
   HEALTH CHECK
============================= */

app.get("/", (req, res) => {
  res.send(
    "Hindi Voice Agent Running"
  );
});

/* =============================
   CALL TRIGGER
============================= */

app.post("/call", async (req, res) => {

  try {

    console.log(
      "Call request body:",
      req.body
    );

    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        error:
          "Phone number required"
      });
    }

    const call =
      await client.calls.create({

        to: to,

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
   VOICE FLOW — HINDI
============================= */

app.post("/twiml", (req, res) => {

  const twiml =
    new VoiceResponse();

  const gather =
    twiml.gather({

      input: "speech",

      language: "hi-IN",

      speechTimeout: "auto",

      timeout: 2,

      method: "POST",

      action:
        `${process.env.PUBLIC_URL}/response`

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
   RESPONSE HANDLER
============================= */

app.post("/response", (req, res) => {

  const twiml =
    new VoiceResponse();

  const speech =
    (req.body.SpeechResult || "")
      .toLowerCase()
      .trim();

  console.log(
    "User said:",
    speech
  );

  const yesWords = [
    "हाँ",
    "haan",
    "ha",
    "करना",
    "बुक",
    "अपॉइंटमेंट"
  ];

  const noWords = [
    "नहीं",
    "nahin",
    "बाद में"
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

    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "ठीक है। आपका अपॉइंटमेंट बुक कर दिया जाएगा। धन्यवाद।"
    );

    twiml.hangup();

  }

  else if (isNo) {

    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "ठीक है। धन्यवाद।"
    );

    twiml.hangup();

  }

  else {

    twiml.say(
      {
        voice: "Polly.Aditi",
        language: "hi-IN"
      },
      "समझ नहीं आया। कृपया फिर से कॉल करें।"
    );

    twiml.hangup();

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
