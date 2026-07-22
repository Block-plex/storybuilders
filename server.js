import express from "express";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const app = express();
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    next();
});
app.options("*", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.sendStatus(200);
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
        // 1. Download levelinfo.txt (or create if missing)
        let infoText = "";
        try {
            const infoObj = await s3.send(new GetObjectCommand({
                Bucket: process.env.R2_BUCKET,
                Key: "levelinfo.txt"
            }));

            const chunks = [];
            for await (const chunk of infoObj.Body) chunks.push(chunk);
            infoText = Buffer.concat(chunks).toString("utf8");
        } catch (err) {
            // File doesn't exist yet → start fresh
            infoText = "";
        }

        // 2. Determine next level ID
        let nextId = 1;
        if (infoText.trim().length > 0) {
            const lines = infoText.trim().split("\n");
            const lastLine = lines[lines.length - 1];
            const lastId = parseInt(lastLine.split(",")[0]);
            nextId = lastId + 1;
        }

        // 3. Read binary body
        const chunks = [];
        req.on("data", chunk => chunks.push(chunk));
        req.on("end", async () => {
            const buffer = Buffer.concat(chunks);

            // 4. Save binary file
            const filename = `level_${String(nextId).padStart(4, "0")}.bin`;

            await s3.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET,
                Key: filename,
                Body: buffer
            }));

            // 5. Append metadata
            const name = req.query.name || `Level ${nextId}`;
            const desc = req.query.desc || "";
            const user = 0;

            const newLine = `${nextId},${name},${desc},${user}\n`;
            const updatedInfo = infoText + newLine;

            await s3.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET,
                Key: "levelinfo.txt",
                Body: updatedInfo
            }));

            // 6. Return new ID to client
            res.json({ id: nextId });
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.get("/download", async (req, res) => {
    const levelId = parseInt(req.query.id);

    const result = await s3.send(new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: `level_${String(levelId).padStart(4, "0")}.bin`
    }));

    const stream = result.Body;
    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);
});

// Required for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
