import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: 'https://pattyyk.github.io',
  methods: ['GET', 'POST', 'OPTIONS'],  // Include OPTIONS for preflight
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Use CORS middleware globally
app.use(cors(corsOptions));

// Handle OPTIONS preflight requests explicitly (optional but recommended)
app.options('*', cors(corsOptions));

app.use(express.json());

app.post('/detect', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  try {
    const response = await fetch('https://api.aiornot.com/v2/text/sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AI_OR_NOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }) // REQUIRED key is "text"
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI or Not API error:', error);
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    console.log('🧪 AI or Not response:\n', JSON.stringify(data, null, 2));

    if (typeof data.is_ai !== 'boolean' || typeof data.confidence !== 'number') {
      return res.status(500).json({ error: 'Unexpected API response structure' });
    }

    const label = data.is_ai ? 'ai' : 'human';
    const confidence = Math.round(data.confidence);

    let icon = '❓';
    if (label === 'ai') icon = '🤖';
    else if (label === 'human') icon = '👤';

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({ label, confidence, icon });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Starting server...');
  console.log('PORT:', port);
  console.log('AI_OR_NOT_TOKEN present:', !!process.env.AI_OR_NOT_TOKEN);
});
