import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';
import multer from 'multer';
const upload = multer();

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://pattyyk.github.io',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '5mb' }));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// === 1. AI TEXT DETECTION (HuggingFace) ===
app.post('/detect', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/openai-community/roberta-base-openai-detector',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    const predictions = Array.isArray(data[0]) ? data[0] : data;
    if (!Array.isArray(predictions) || predictions.length === 0) {
      return res.status(500).json({ error: 'No predictions returned by the model.' });
    }

    const topPrediction = predictions[0];
    const rawLabel = topPrediction.label.toLowerCase();
    const confidence = Math.round(topPrediction.score * 100);

    let label = 'unknown';
    if (rawLabel === 'label_0' || rawLabel.includes('real')) {
      label = 'ai';
    } else if (rawLabel === 'label_1' || rawLabel.includes('fake')) {
      label = 'human';
    }
    const icon = label === 'ai' ? '🤖' : label === 'human' ? '👤' : '❓';

    res.json({ label, confidence, icon });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// === 2. IMAGE DETECTION ===
app.post('/image-detect', upload.single('media'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing image file (field name should be "media")' });
  }

  try {
    const form = new FormData();
    form.append('api_user', process.env.SIGHTENGINE_USER);
    form.append('api_secret', process.env.SIGHTENGINE_SECRET);
    form.append('models', 'genai');
    form.append('media', req.file.buffer, {
      filename: req.file.originalname || 'upload.jpg',
      contentType: req.file.mimetype || 'image/jpeg',
    });

    const response = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Sightengine detection failed', raw: result });
    }

    // Extract numeric confidence and label
   let confidence = 0;
let label = "unknown";
let icon = "❓";

if (result.type && typeof result.type.ai_generated !== "undefined") {
  if (typeof result.type.ai_generated === "boolean" || typeof result.type.ai_generated === "string") {
    if (result.type.ai_generated === true || result.type.ai_generated === "true") {
      confidence = 80;
      label = "ai";
      icon = "🤖";
    } else if (
      result.type.ai_generated === false ||
      result.type.ai_generated === "false" ||
      result.type.ai_generated === "no"
    ) {
      confidence = 10;
      label = "human";
      icon = "👤";
    } else if (result.type.ai_generated === "likely") {
      confidence = 60;
      label = "ai";
      icon = "🤖";
    } else if (result.type.ai_generated === "unknown") {
      confidence = 0;
      label = "unknown";
      icon = "❓";
    }
  } else if (typeof result.type.ai_generated === "number") {
    // Handle numeric confidence between 0 and 1
    confidence = Math.round(result.type.ai_generated * 100);
    label = confidence > 50 ? "ai" : "human";
    icon = label === "ai" ? "🤖" : "👤";
  }
}

// If Sightengine provides a real confidence score, use it
if (result.type && typeof result.type.ai_generated_score === "number") {
  confidence = Math.round(result.type.ai_generated_score * 100);
  label = confidence > 50 ? "ai" : "human";
  icon = label === "ai" ? "🤖" : "👤";
}

res.json({
  label,
  confidence,
  icon,
  raw: result,
});

  } catch (err) {
    res.status(500).json({ error: 'Image detection failed', details: err.message });
  }
});

// === 3. FAKE NEWS DETECTION VIA CLAUDE ===
app.post('/fake-news-check', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20240620',
        messages: [
          {
            role: 'user',
            content: `Please evaluate the following article or statement to determine if it may be fake news. Give a verdict ("Likely Real", "Possibly Fake", or "Likely Fake"), a confidence score out of 100, and a one sentence rationale.\n\nText:\n${text}`
          }
        ],
        max_tokens: 1000
      },
      {
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    const rawOutput = response.data?.content?.[0]?.text || 'No response from Claude';
    res.json({ verdict: rawOutput });
  } catch (error) {
    console.error('Claude API error:', error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data || error.message });
  }
});

// === 4. EXPLANATION FOR FAKE NEWS VERDICT ===
app.post('/api/fake-news-explain', async (req, res) => {
  const { text, verdict } = req.body;
  if (!text || !verdict) {
    return res.status(400).json({ error: 'Missing text or verdict for explanation.' });
  }

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20240620',
        messages: [
          {
            role: 'user',
            content: `Please explain in detail why this content might be fake or real:\n\n"${text}"\n\nClaude's initial verdict: ${verdict}`
          }
        ],
        max_tokens: 1000
      },
      {
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    const explanation = response.data?.content?.[0]?.text || 'No explanation returned';
    res.json({ explanation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

console.log('Starting server...');
console.log('PORT:', port);
console.log('HUGGINGFACE_API_TOKEN:', !!process.env.HUGGINGFACE_API_TOKEN);
