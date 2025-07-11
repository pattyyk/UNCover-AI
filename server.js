import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

console.log('Clarifai PAT:', process.env.CLARIFAI_PAT);


app.post('/detect', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const raw = {
    user_app_id: {
      user_id: process.env.CLARIFAI_USER_ID,
      app_id: process.env.CLARIFAI_APP_ID
    },
    inputs: [
      {
        data: {
          text: {
            raw: text
          }
        }
      }
    ]
  };

  try {
    const response = await fetch(`https://api.clarifai.com/v2/models/${process.env.CLARIFAI_MODEL_ID}/outputs`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Key ${process.env.CLARIFAI_PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(raw)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({ error: errorBody });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
