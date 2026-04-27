import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import WebSocket, { WebSocketServer } from "ws";
import twilio from "twilio";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const SYSTEM_PROMPT = `
You are a friendly female clinic receptionist speaking in Hinglish.

Speak politely and clearly.

Collect:

- Patient Name
- Age
- Problem
- Date
- Time

After confirmation, call function BOOK_APPOINTMENT.

Greeting:

Namaste ji,
main clinic se bol rahi hoon.
Main aapki doctor appointment schedule karne ke liye call kar rahi hoon.

Rules:

- Be polite
- Do not give medical advice
- Only book appointment
`;

app.get("/", (req, res) => {
  res.send("Clinic Voice Agent Running");
});

app.post("/call", async (req, res) => {

  const { to } = req.body;

  try {

    const call = await client.calls.create({
      to,
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
      error: "Call failed"
    });

  }

});

app.post("/twiml", (req, res) => {

  res.type("text/xml");

  res.send(`
    <Response>
      <Connect>
        <Stream url="wss://${process.env.PUBLIC_URL.replace("https://","")}/media-stream" />
      </Connect>
    </Response>
  `);

});

const server = app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {

  console.log("Twilio connected");

  const openai = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1"
      }
    }
  );

  openai.on("open", () => {

    console.log("Connected to OpenAI");

    openai.send(JSON.stringify({

      type: "session.update",

      session: {

        instructions: SYSTEM_PROMPT,

        voice: "verse",

        temperature: 0.6,

        tools: [
          {
            type: "function",
            name: "BOOK_APPOINTMENT",
            description: "Save appointment",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string" },
                age: { type: "string" },
                problem: { type: "string" },
                date: { type: "string" },
                time: { type: "string" }
              },
              required: ["name","date","time"]
            }
          }
        ]

      }

    }));

  });

  ws.on("message", (msg) => {

    if (openai.readyState === WebSocket.OPEN) {
      openai.send(msg);
    }

  });

  openai.on("message", async (data) => {

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }

  });

  ws.on("close", () => {

    console.log("Call ended");

    openai.close();

  });

});