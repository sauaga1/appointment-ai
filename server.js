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

/* =========================
   SEND WHATSAPP
========================= */
async function sendWhatsAppLink(customerNumber) {
  try {
    const message = await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
  to: `whatsapp:${process.env.CUSTOMER_NUMBER}`,
  body: `नमस्ते,\n\nकृपया इस लिंक पर क्लिक करें:\n${process.env.WHATSAPP_LINK}`
    });

    console.log("WhatsApp sent:", message.sid);
  } catch (error) {
    console.error("WhatsApp error:", error.message);
  }
}

/* =========================
   INCOMING CALL WEBHOOK
========================= */
app.post("/voice", (req, res) => {
  const twiml = new VoiceResponse();

  const customerNumber = req.body.From;

  // WhatsApp immediately
  sendWhatsAppLink(customerNumber).catch(console.error);

  // Voice message
  twiml.say(
    {
      voice: "Polly.Aditi",
      language: "hi-IN"
    },
    "नमस्ते। ग्राहक सेवा से में बात करने के लिए, मैंने आपके व्हाट्सएप पर एक लिंक भेजी है। कृपया उसे खोलें। धन्यवाद।"
  );

  twiml.hangup();

  res.type("text/xml");
  res.send(twiml.toString());
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("Twilio WhatsApp service running");
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
