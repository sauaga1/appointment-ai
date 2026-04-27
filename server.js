import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VoiceResponse = twilio.twiml.VoiceResponse;

/* =============================
   TEMP BOOKING STORAGE
============================= */

let bookingData = {
  name: "",
  date: "",
  time: ""
};

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
   HEALTH CHECK
============================= */

app.get("/", (req, res) => {
  res.send("Clinic Voice Agent Running");
});

/* =============================
   STEP 1 — GREETING
============================= */

app.post("/twiml", (req, res) => {

  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: "speech",
    language: "en-US",
    action: `${process.env.PUBLIC_URL}/intent`,
    method: "POST",
    timeout: 3,
    speechTimeout: "auto",
    actionOnEmptyResult: true
  });

  gather.say(
    {
      voice: "Polly.Joanna"
    },
    "Hello, this is Riya from the clinic. Would you like to book an appointment?"
  );

  res.type("text/xml");
  res.send(twiml.toString());

});

/* =============================
   STEP 2 — INTENT
============================= */

app.post("/intent", (req, res) => {

  const twiml = new VoiceResponse();

  const speech =
    (req.body.SpeechResult || "")
      .toLowerCase()
      .trim();

  console.log("Intent:", speech);

  const yesWords = [
    "yes",
    "book",
    "appointment",
    "doctor",
    "schedule"
  ];

  const noWords = [
    "no",
    "cancel",
    "later"
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

    const gather = twiml.gather({
      input: "speech",
      language: "en-US",
      action: `${process.env.PUBLIC_URL}/get-name`,
      method: "POST",
      timeout: 3,
      speechTimeout: "auto",
      actionOnEmptyResult: true
    });

    gather.say(
      {
        voice: "Polly.Joanna"
      },
      "Okay. Please tell me your name."
    );

  }

  else if (isNo) {

    twiml.say(
      {
        voice: "Polly.Joanna"
      },
      "Okay. Thank you."
    );

    twiml.hangup();

  }

  else {

    twiml.say(
      {
        voice: "Polly.Joanna"
      },
      "Please say yes or no."
    );

    twiml.redirect(
      `${process.env.PUBLIC_URL}/twiml`
    );

  }

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

  bookingData.name = name;

  console.log("Name:", name);

  const gather = twiml.gather({
    input: "speech",
    language: "en-US",
    action: `${process.env.PUBLIC_URL}/get-date`,
    method: "POST",
    timeout: 3,
    speechTimeout: "auto",
    actionOnEmptyResult: true
  });

  gather.say(
    {
      voice: "Polly.Joanna"
    },
    `Thank you ${name}. Which date would you like to book your appointment?`
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
    req.body.SpeechResult || "Tomorrow";

  bookingData.date = date;

  console.log("Date:", date);

  const gather = twiml.gather({
    input: "speech",
    language: "en-US",
    action: `${process.env.PUBLIC_URL}/get-time`,
    method: "POST",
    timeout: 3,
    speechTimeout: "auto",
    actionOnEmptyResult: true
  });

  gather.say(
    {
      voice: "Polly.Joanna"
    },
    `Great. Your appointment is being scheduled for ${date}. Please choose a time slot. Available times are 10 AM, 11:30 AM, 2 PM, or 4:30 PM.`
  );

  res.type("text/xml");
  res.send(twiml.toString());

});

/* =============================
   STEP 5 — TIME SLOT + SAVE
============================= */

app.post("/get-time", (req, res) => {

  const twiml = new VoiceResponse();

  const speech =
    (req.body.SpeechResult || "")
      .toLowerCase()
      .trim();

  console.log("Time speech:", speech);

  const timeSlots = [
    "10:00 am",
    "11:30 am",
    "2:00 pm",
    "4:30 pm"
  ];

  let selectedTime = null;

  for (let slot of timeSlots) {

    if (
      speech.includes(slot) ||
      speech.includes(
        slot.replace(":00", "")
      ) ||
      speech.includes(
        slot.replace(":", "")
      )
    ) {
      selectedTime = slot;
      break;
    }

  }

  if (selectedTime) {

    bookingData.time =
      selectedTime;

    console.log(
      "Final booking:",
      bookingData
    );

    saveAppointmentAsync(
      bookingData
    );

    twiml.say(
      {
        voice: "Polly.Joanna"
      },
      `Your appointment has been booked for ${selectedTime}. Thank you.`
    );

    twiml.hangup();

  }

  else {

    const gather =
      twiml.gather({

        input: "speech",
        language: "en-US",

        action:
          `${process.env.PUBLIC_URL}/get-time`,

        method: "POST",

        timeout: 3,
        speechTimeout: "auto",
        actionOnEmptyResult: true
      });

    gather.say(
      {
        voice: "Polly.Joanna"
      },
      "Please choose a valid time slot. Available times are 10 AM, 11:30 AM, 2 PM, or 4:30 PM."
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
