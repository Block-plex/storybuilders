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
    endpoint: `https://${process.env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_ACCESS_KEY
    }
});

// Save route
app.post("/save", async (req, res) => {
    try {
        const chunks = [];

        req.on("data", chunk => chunks.push(chunk));
        req.on("end", async () => {
            const buffer = Buffer.concat(chunks);

            console.log("Received bytes:", buffer.length);

            await s3.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET,
                Key: "sqlvlpck001.txt",
                Body: buffer
            }));

            res.status(200).send("OK");
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.get("/download", async (req, res) => {
    try {
        const result = await s3.send(new GetObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: "sqlvlpck001.txt"
        }));

        const stream = result.Body;
        const chunks = [];

        for await (const chunk of stream) {
            chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);

        res.setHeader("Content-Type", "application/octet-stream");
        res.send(buffer);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// Required for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
