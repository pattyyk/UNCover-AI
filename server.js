import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ✅ Middleware
app.use(cors({
  origin: 'https://pattyyk.github.io',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ✅ Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('AI_OR_NOT_TOKEN:', !!process.env.AI_OR_NOT_TOKEN);
});

app.post('/detect', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  try {
    const response = await fetch('https://api.aiornot.com/v2/text/sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AI_OR_NOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text })  // 🔁 Correct field is `input` not `inputs`
    });

    const data = await response.json();
    console.log('🧪 AI or Not response:\n', JSON.stringify(data, null, 2));

    // ✅ Validate expected fields
    if (!data.hasOwnProperty('ai') || typeof data.ai !== 'boolean' || typeof data.confidence !== 'number') {
      return res.status(500).json({ error: 'Unexpected API response structure' });
    }

    // ✅ Map values
    const label = data.ai ? 'ai' : 'human';
    const confidence = Math.round(data.confidence * 100);
    const icon = label === 'ai' ? '🤖' : '👤';

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({ label, confidence, icon });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message });
  }
});
