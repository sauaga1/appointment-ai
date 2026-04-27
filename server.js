import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

const app = express();
app.use(express.json());

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Health check
app.get("/", (req, res) => {
  res.send("Clinic Voice Agent Running");
});


// Call trigger API
app.post("/call", async (req, res) => {
  try {
    const { to } = req.body;

    const call = await client.calls.create({
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${process.env.PUBLIC_URL}/twiml`
    });

    res.json({
      success: true,
      callSid: call.sid
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// Voice response (Hindi female voice)
app.post("/twiml", (req, res) => {
  const VoiceResponse = twilio.twiml.VoiceResponse;

  const twiml = new VoiceResponse();

  twiml.say(
  {
    voice: "Polly.Aditi",
    language: "hi-IN"
  },
  "Namaste ji, main Riya bol rahi hoon. Kya aap doctor ka appointment book karna chahte hain?"
);

  res.type("text/xml");
  res.send(twiml.toString());
});


const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
