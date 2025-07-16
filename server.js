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

// === 3. FAKE NEWS DETECTION VIA CLAUDE 3.5 ===
app.post('/api/fake-news-check', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  try {
    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3.5-sonnet-20240620',
          messages: [
            {
              role: 'user',
              content: `Please evaluate the following article or statement to determine if it may be fake news. Give a verdict ("Likely Real", "Possibly Fake", or "Likely Fake"), a confidence score out of 100, and a short explanation that references reliable sources or reasoning.\n\nText:\n"""${text}"""`
            }
          ],
          max_tokens: 1000
        })
      }
    );

    const data = await response.json();
    const rawOutput = data?.content?.[0]?.text || 'No response from Claude';

    res.json({
      verdict: rawOutput
    });
  } catch (error) {
    console.error('❌ Claude error:', error);
    res.status(500).json({ error: error.message });
  }
});


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
  label = 'ai';
} else if (rawLabel === 'label_1' || rawLabel.includes('fake')) {
  label = 'human';
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

//image detection
app.get('/copyleaks-token', async (req, res) => {
  try {
    const { COPYLEAKS_EMAIL, COPYLEAKS_API_KEY } = process.env;

    const authRes = await fetch('https://id.copyleaks.com/v3/account/login/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: COPYLEAKS_EMAIL,
        key: COPYLEAKS_API_KEY
      })
    });

    if (!authRes.ok) {
      const error = await authRes.text();
      return res.status(401).json({ error });
    }

    const data = await authRes.json();
    res.json({ access_token: data.access_token });

  } catch (err) {
    console.error('Token fetch error:', err);
    res.status(500).json({ error: 'Failed to get Copyleaks token' });
  }
});

app.use(express.json({ limit: '5mb' }));

// === 2. IMAGE DETECTION VIA COPYLEAKS ===
app.post('/image-detect', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Missing image' });

    // Step 1: Authenticate with Copyleaks
    const authRes = await fetch('https://id.copyleaks.com/v3/account/login/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.COPYLEAKS_EMAIL,
        key: process.env.COPYLEAKS_API_KEY
      })
    });

    const authText = await authRes.text();
    let authData;

    try {
      authData = JSON.parse(authText);
    } catch (err) {
      console.error('❌ Failed to parse Copyleaks auth response:', authText);
      return res.status(500).json({ error: 'Auth JSON parsing error' });
    }

    if (!authRes.ok || !authData.access_token) {
      console.error('❌ Copyleaks auth failed:', authData);
      return res.status(401).json({ error: 'Invalid Copyleaks credentials' });
    }

    const token = authData.access_token;

    // Extract base64 safely
    let imageBase64 = image;
    if (typeof image === 'string' && image.startsWith('data:')) {
      const parts = image.split(',');
      if (parts.length === 2) {
        imageBase64 = parts[1];
      } else {
        console.error('❌ Malformed base64 image input');
        return res.status(400).json({ error: 'Malformed image base64 input' });
      }
    } else if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    console.log('📸 Sending base64 to Copyleaks:', imageBase64.slice(0, 30), '...');

    // Step 2: Send image for detection
    const apiRes = await fetch('https://api.copyleaks.com/v1/ai-content-detector/image/base64', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ base64: imageBase64 })
    });

    const rawText = await apiRes.text();
    console.log('📩 Copyleaks raw response:', rawText);
    console.log('🧾 Copyleaks status:', apiRes.status);

    let result;

    if (!rawText) {
      console.error('❌ Empty response from Copyleaks');
      return res.status(500).json({ error: 'Empty response from Copyleaks' });
    }

    try {
      result = JSON.parse(rawText);
    } catch (err) {
      console.error('❌ Failed to parse Copyleaks image response:', rawText);
      return res.status(500).json({ error: 'Detection JSON parsing error' });
    }

    if (!apiRes.ok || typeof result.ai === 'undefined') {
      console.error('❌ Invalid response from Copyleaks:', result);
      return res.status(500).json({ error: 'Invalid response from Copyleaks' });
    }

    const label = result.ai ? 'ai' : 'human';
    const confidence = result.confidence || 0;
    const icon = label === 'ai' ? '🤖' : '👤';

    res.json({ label, confidence, icon });

  } catch (err) {
    console.error('❌ Image detection error:', err);
    res.status(500).json({ error: 'Image detection failed' });
  }
});




console.log('Starting server...');
console.log('PORT:', port);
console.log('HUGGINGFACE_API_TOKEN:', !!process.env.HUGGINGFACE_API_TOKEN);
