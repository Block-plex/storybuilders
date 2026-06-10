import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import http from "http";

dotenv.config();

const app = express();
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_KEY
});

// Create HTTP server manually so WS can attach to it
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.send(JSON.stringify({ type: "welcome", message: "Connected to Story WebSocket" }));

  ws.on("close", () => console.log("Client disconnected"));
});

// Broadcast helper
function broadcast(data) {
  const json = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(json);
    }
  });
}

// POST /chapter
app.post("/chapter", async (req, res) => {
  const { item, previousChapter } = req.body;

  const prompt = `
  Write the next chapter of a fantasy story.
  Theme item: ${item}
  Previous chapter: ${previousChapter || "None yet"}
  `;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const chapter = response.choices[0].message.content;

    // Broadcast to all connected WebSocket clients
    broadcast({
      type: "new_chapter",
      item,
      chapter
    });

    res.json({ chapter });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port " + PORT));
