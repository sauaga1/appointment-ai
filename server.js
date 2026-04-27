import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// Trigger outbound call
app.post("/call", async (req, res) => {
  res.json({ status: "calling", to: req.body.to });
});

app.get("/", (req, res) => res.send("AI Appointment Agent Running"));
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Server running on " + PORT));
