import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// ✅ Use CORS config before routes
app.use(cors({
  origin: 'https://pattyyk.github.io',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());



app.post('/detect', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  try {
    const response = await fetch(
            'https://api.aiornot.com/v2/text/sync',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AI_OR_NOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('HuggingFace API error:', error);
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    console.log('🧪 Hugging Face raw response:\n', JSON.stringify(data, null, 2));

    // Extract inner predictions array (nested array case)
    const predictions = Array.isArray(data[0]) ? data[0] : data;

    if (!Array.isArray(predictions) || predictions.length === 0) {
      return res.status(500).json({ error: 'No predictions returned by the model.' });
    }

    const topPrediction = predictions[0];

    if (!topPrediction.label || typeof topPrediction.score !== 'number') {
      return res.status(500).json({ error: 'Missing label or score in HF API response' });
    }

const rawLabel = topPrediction.label.toLowerCase();
const confidence = Math.round(topPrediction.score * 100);

// Map raw label to friendly label for frontend: human = real, ai = fake
let label;
if (rawLabel === 'label_0' || rawLabel.includes('real')) {
  label = 'human';
} else if (rawLabel === 'label_1' || rawLabel.includes('fake')) {
  label = 'ai';
} else {
  console.warn('⚠️ Unknown label format from HF:', rawLabel);
  label = `unknown (${rawLabel})`;
}
let icon;
if (label === 'ai') {
  icon = '🤖';
} else if (label === 'human') {
  icon = '👤';
} else {
  icon = '❓';
}
    // ... your existing code inside try ...
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({ label, confidence, icon });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message });
  }
});  // <-- this was missing

console.log('Starting server...');
console.log('PORT:', port);
console.log('HUGGINGFACE_API_TOKEN:', !!process.env.HUGGINGFACE_API_TOKEN);
