import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import cors from "cors";
import { WebSocketServer } from "ws";
import http from "http";
import Twilio from "twilio";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// -------------------------------------------
// 1) Twilio Client
// -------------------------------------------
const twilioClient = Twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH
);

// -------------------------------------------
// 2) Outbound Call API
// -------------------------------------------
app.post("/call", async (req, res) => {
  try {
    const { to } = req.body;

    const call = await twilioClient.calls.create({
      twiml: `<Response>
                <Connect>
                    <Stream url="${process.env.RAILWAY_PUBLIC_DOMAIN}/media-stream" />
                </Connect>
             </Response>`,
      to,
      from: process.env.TWILIO_NUMBER,
    });

    res.json({ status: "CALL_STARTED", call_sid: call.sid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------
// 3) WebSocket Upgrade for Twilio Stream
// -------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/media-stream") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  }
});

// -------------------------------------------
// 4) On Call Stream Connected
// -------------------------------------------
wss.on("connection", async (ws) => {
  console.log("🔗 Twilio Stream Connected");

  // Connect OpenAI Realtime
  const openai = new WebSocket("wss://api.openai.com/v1/realtime", {
    headers: { Authorization: `Bearer ${process.env.OPENAI_KEY}` }
  });

  // Forward Twilio audio → OpenAI
  ws.on("message", (msg) => {
    openai.send(msg);
  });

  // Forward OpenAI → Twilio
  openai.on("message", (data) => {
    ws.send(data);
  });

  // Auto Appointment Booking via PHP API
  openai.on("message", async (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.event === "appointment.book") {
        await axios.post(process.env.APPOINTMENT_API_URL, {
          name: data.name,
          phone: data.phone,
          slot: data.slot
        });
        console.log("📌 Appointment Saved to Database");
      }
    } catch {}
  });
});

// -------------------------------------------
// 5) Health Route
// -------------------------------------------
app.get("/", (req, res) =>
  res.send("🚀 AI Appointment Agent Working — Railway")
);

// -------------------------------------------
// 6) Start Server
// -------------------------------------------
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log("Server running on PORT " + PORT));
