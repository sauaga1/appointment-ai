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
async function sendWhatsAppLink(to) {
  try {
    const message = await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${to}`,
      body: `नमस्ते,\n\nकृपया नीचे दिए गए लिंक पर क्लिक करें:\n${process.env.WHATSAPP_LINK}`
    });

    console.log("WhatsApp sent:", message.sid);
  } catch (error) {
    console.error("WhatsApp send failed:", error.message);
  }
}

/* =========================
   START OUTBOUND CALL
========================= */
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================
   CALL FLOW
========================= */
app.post("/twiml", (req, res) => {
  const twiml = new VoiceResponse();

  const customerNumber = req.body.Called || req.body.To;

  // send WhatsApp in background
  process.nextTick(() => {
    sendWhatsAppLink(customerNumber);
  });

  // voice message
  twiml.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "नमस्ते। आपकी सुविधा के लिए मैंने आपके व्हाट्सएप पर एक लिंक भेजी है। कृपया उसे खोलें। धन्यवाद।"
  );

  twiml.pause({ length: 1 });

  twiml.hangup();

  res.type("text/xml");
  res.send(twiml.toString());
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("Voice + WhatsApp service running");
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
