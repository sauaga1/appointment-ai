import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";
import http from "http";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VoiceResponse = twilio.twiml.VoiceResponse;

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* =========================
   SEND WHATSAPP MESSAGE
========================= */
async function sendWhatsAppLink(customerNumber) {
  try {
    const message = await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${customerNumber}`,
      body: `नमस्ते,\n\nकृपया नीचे दिए गए लिंक पर क्लिक करें:\n${process.env.WHATSAPP_LINK}`
    });

    console.log("WhatsApp sent:", message.sid);
  } catch (error) {
    console.error("WhatsApp failed:", error.message);
  }
}

/* =========================
   INCOMING CALL HANDLER
========================= */
app.post("/voice", (req, res) => {
  const twiml = new VoiceResponse();

  const customerNumber = req.body.From;

  // background WhatsApp send
  process.nextTick(() => {
    sendWhatsAppLink(customerNumber.replace("whatsapp:", ""));
  });

  // Welcome message
  twiml.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "नमस्ते।"
  );

  // Inform message
  twiml.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "मैंने आपके व्हाट्सएप पर एक लिंक भेजी है।"
  );

  // Thanks
  twiml.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "धन्यवाद।"
  );

  // End call
  twiml.hangup();

  res.type("text/xml");
  res.send(twiml.toString());
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("Incoming call + WhatsApp service running");
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

http.createServer(app).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
