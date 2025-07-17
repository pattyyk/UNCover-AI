import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app.use(cors({
  origin: 'https://pattyyk.github.io',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '5mb' }));

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

// === 2. IMAGE DETECTION VIA COPYLEAKS ===
app.get('/copyleaks-token', async (req, res) => {
  try {
    const { COPYLEAKS_EMAIL, COPYLEAKS_API_KEY } = process.env;
    const authRes = await fetch('https://id.copyleaks.com/v3/account/login/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: COPYLEAKS_EMAIL, key: COPYLEAKS_API_KEY })
    });
    if (!authRes.ok) {
      const error = await authRes.text();
      return res.status(401).json({ error });
    }
    const data = await authRes.json();
    res.json({ access_token: data.access_token });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get Copyleaks token' });
  }
});
app.post('/image-detect', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Missing image' });

    const base64 = image.includes(',') ? image.split(',')[1] : image;
    if (!base64 || base64.length < 100) {
      return res.status(400).json({ error: 'Invalid or empty image data.' });
    }

    // Use existing token directly in Authorization header
    const apiRes = await fetch('https://api.copyleaks.com/v3/misc/detect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COPYLEAKS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base64 })
    });

    const rawText = await apiRes.text();
    console.log('Copyleaks raw response:', rawText); // debug log

    let result;
    try {
      result = JSON.parse(rawText);
    } catch (err) {
      console.error('JSON parse failed:', rawText);
      return res.status(500).json({ error: 'Detection JSON parsing error' });
    }

    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ error: result.error || 'Detection failed' });
    }

    res.json(result);
  } catch (err) {
    console.error('Backend error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});


// Success
res.json(result);


    const label = result.ai ? 'ai' : 'human';
    const confidence = result.confidence || 0;
    const icon = label === 'ai' ? '🤖' : '👤';

    res.json({ label, confidence, icon });
  } catch (err) {
    res.status(500).json({ error: 'Image detection failed' });
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
            content: `Please evaluate the following article or statement to determine if it may be fake news. Give a verdict ("Likely Real", "Possibly Fake", or "Likely Fake"), a confidence score out of 100, and a brief explanation. Text: "${text}"`
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

// === FAKE NEWS ROUTES ===
app.post('/api/fake-news-check', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' }); // FIX: add missing check for "text"

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3.5-sonnet-20240620',
        max_tokens: 1000,
        messages: [{ role: 'user', content: `Is the following text fake news? Respond with a clear answer: ${text}` }]
      })
    });

    const data = await response.json();
    const content = data?.content?.[0]?.text || 'No verdict returned.';
    res.json({ verdict: content });
  } catch (err) {
    console.error('Error checking fake news:', err);
    res.status(500).json({ error: 'Fake news check failed.' });
  }
});

app.post('/api/fake-news-explain', async (req, res) => {
  const { text, verdict } = req.body;
  if (!text || !verdict) {
    return res.status(400).json({ error: 'Missing text or verdict for explanation.' }); // FIX: add missing check for both fields
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3.5-sonnet-20240620',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: `You previously said this was your verdict: "${verdict}". Now, explain your reasoning. Original text:\n${text}` }
        ]
      })
    });

    const data = await response.json();
    const explanation = data?.content?.[0]?.text || 'No explanation returned.';
    res.json({ explanation });
  } catch (err) {
    console.error('Error explaining verdict:', err);
    res.status(500).json({ error: 'Explanation failed.' });
  }
});

