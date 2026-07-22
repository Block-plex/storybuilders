import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import http from "http";
import cors from "cors";
dotenv.config();

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_ACCESS_KEY
    }
});

const app = express();
app.use(express.json());

app.use(cors({
  origin: [
    "http://127.0.0.1:5500",
    "https://badgrr.net"
  ]
}));

app.post("/save", async (req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", async () => {
        const fileBuffer = Buffer.concat(chunks);

        // Upload to Cloudflare R2
        await s3.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: "save.bin",
            Body: fileBuffer
        }));

        res.send("Saved");
    });
});

