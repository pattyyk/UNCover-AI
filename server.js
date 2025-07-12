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
    const response = await fetch('https://api-inference.huggingface.co/models/openai-community/roberta-base-openai-detector', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    console.log('HF API raw response:', data);

    const predictions = Array.isArray(data[0]) ? data[0] : data;

    if (!Array.isArray(predictions) || predictions.length === 0) {
      return res.status(500).json({ error: 'No predictions returned by the model.' });
    }
    console.log('HF API raw response:', data);

    const topPrediction = data[0];

if (!topPrediction.label || typeof topPrediction.score !== 'number') {
  return res.status(500).json({ error: 'Missing label or score in HF API response' });
}

const rawLabel = topPrediction.label.toLowerCase();
const confidence = Math.round(topPrediction.score * 100);

// ✅ Map HF label to friendly label for frontend
let label;
if (rawLabel.includes('real') || rawLabel === 'label_0') {
  label = 'real';
} else if (rawLabel.includes('fake') || rawLabel === 'label_1') {
  label = 'fake';
} else {
  label = 'unknown'; // just in case
}

res.json({ label, confidence });


  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message });
  }
});





console.log('Starting server...');
console.log('PORT:', port);
console.log('HUGGINGFACE_API_TOKEN:', !!process.env.HUGGINGFACE_API_TOKEN);
