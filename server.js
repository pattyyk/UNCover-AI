import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all origins temporarily for testing
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Test root endpoint
app.get('/', (req, res) => res.send('Hello World!'));

// Step 1: Add a basic /detect route that just echoes the input text
app.post('/detect', (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }
  // For now just respond with the same text to confirm it works
  res.json({ received: text });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
