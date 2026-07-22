import express from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const app = express();
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    next();
});

// Cloudflare R2 client
const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_KEY,
        secretAccessKey: process.env.R2_SECRET
    }
});

// Save route
app.post("/save", async (req, res) => {
    const levelId = 1;
    const packIndex = Math.floor(levelId / 1000) + 1;
    const filename = `sqlvlpck${String(packIndex).padStart(3, "0")}.txt`;

    try {
        await s3.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: filename,
            Body: req.body
        }));

        res.send("Saved");
    } catch (err) {
        console.error(err);
        res.status(500).send("Upload failed");
    }
});

// Required for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
