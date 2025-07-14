import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Add the logging middleware here, before routes:
app.use((req, res, next) => {
  console.log('Incoming request:', req.method, req.url);
  console.log('Headers:', req.headers);
  next();
});

app.get('/', (req, res) => res.send('Hello World!'));

app.post('/detect', async (req, res) => {
  console.log('Request body:', req.body);
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  try {
    const response = await fetch('https://api.aiornot.com/v2/text/sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AI_OR_NOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI or Not API error:', errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();

    if (typeof data.is_ai !== 'boolean' || typeof data.confidence !== 'number') {
      return res.status(500).json({ error: 'Unexpected API response structure' });
    }

    const label = data.is_ai ? 'ai' : 'human';
    const confidence = Math.round(data.confidence);

    let icon = '❓';
    if (label === 'ai') icon = '🤖';
    else if (label === 'human') icon = '👤';

    res.json({ label, confidence, icon });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
