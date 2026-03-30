import express from 'express';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/analyze-hygiene', upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'shoes', maxCount: 1 },
    { name: 'area', maxCount: 1 }
]), async (req, res) => {
    try {
        const files = req.files;
        if (!files.selfie || !files.shoes || !files.area) {
            return res.status(400).json({ error: "Please upload all three images." });
        }

        const fileToGenerativePart = (file) => ({
            inlineData: {
                data: file[0].buffer.toString("base64"),
                mimeType: file[0].mimetype
            }
        });

        const imageParts = [
            fileToGenerativePart(files.selfie),
            fileToGenerativePart(files.shoes),
            fileToGenerativePart(files.area)
        ];

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
        You are a strict food safety and hygiene auditor.
        Analyze these 3 images: Selfie, Shoes, and Standing Area.
        Return a JSON object with EXACTLY these keys:
        - "headcap" (boolean): true if wearing a proper headcap/hairnet, false if not.
        - "shoes" (boolean): true if wearing closed-toe shoes, false if flip-flops/barefoot.
        - "clean" (boolean): true if the floor area is clean, false if dirty/cluttered.
        - "feedback" (string): A short 1-sentence summary of any violations.
        `;

        const result = await model.generateContent([prompt, ...imageParts]);
        const responseText = result.response.text();
        
        res.json(JSON.parse(responseText));

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "AI processing failed." });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});