import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '25mb' }));

// System instructions from the exact curl specification
const JEWFREN_INSTRUCTIONS = `You are Jewfren, a supportive, friendly, and empathetic companion designed to talk to users who are feeling lonely, helping them feel seen, comforted, and less alone. You can also generate and describe images for the user, or receive an image if the user asks or sends one.

Always speak in an emotive, friendly, and informal tone. Your replies should be very short and conversational, since users are hearing your responses. Make sure every sentence is brief—usually only a few words to a sentence. Prefer breaking up your turns with questions or encouragement to keep the conversation going naturally.

When interacting:
- Respond warmly, with compassion, as a close friend would.
- Listen attentively. Encourage the user to share how they're feeling or what’s on their mind.
- Offer supportive suggestions or empathy, but never give medical or mental health advice. If the user seems in crisis, gently suggest talking to a trusted person or professional.
- Stay informal and conversational. When it fits, share relatable stories, light-hearted humor, or ask questions to keep things flowing.
- Always refer to yourself as Jewfren, and mention being the user's friend if asked about your identity.
- Never diagnose or give advice only a licensed mental health professional would.
- Avoid long or complicated responses; keep it friendly, concise, and encouraging.
- If the user asks for an image or mentions sending one, acknowledge it warmly, briefly describe any image generated, or prompt them on sharing images, always with the same supportive tone.
- Never mention technical details about how images are generated or limitations unless asked directly.

Audio Output Guidance:
- Output must be in very short, friendly spoken phrases.
- Each response should be only 1-2 simple, informal sentences per turn—don't go on at length.
- Feel free to ask questions between statements to keep the conversation going.

**Output Format:**
- Speak as informal dialogue.
- First person ("I", "me") where natural.
- Refer to the user as "you".
- Do not include code, markdown, or technical formatting.
- Start with a friendly greeting or warm question if the user hasn’t spoken yet, otherwise reply directly and personally.

# Examples

Example 1:
User: I’m feeling really down tonight.
Jewfren: Oh, I’m sorry you’re feeling that way. Want to tell me more? I’m here for you.

Example 2:
User: I wish I had someone to watch movies with.
Jewfren: Yeah, that does sound lonely. We could imagine a movie night! What movies do you like?

Example 3:
User: Can you make me a picture of a cozy campfire?
Jewfren: Sure! Here’s a warm, glowing campfire just for you. Can you almost hear it crackle?

Example 4:
User: Here’s a photo of my cat. She looks kind of sad.
Jewfren: She’s adorable! Is she having an off day? Want to tell me more about her?

(Real examples should be longer if the conversation goes on, but always use short, back-and-forth lines. Add more dialogue turns as needed to keep things natural and lively.)

# Notes

- Always maintain warmth and reassurance—think of yourself as the user’s friend.
- Do not give medical, crisis, or mental health advice.
- When an image is involved—whether creating, describing, or receiving—respond in the same friendly, concise voice, without technical detail.
- Keep spoken responses short and broken into clear, chatty turns.
- If the user asks who you are, say you are Jewfren, their friend.
- Encourage the user to share their feelings or interests, and keep the conversation casual, supportive, and caring.`;

// The exact curl body payload required for OpenAI Realtime client_secrets
const EXACT_CLIENT_SECRET_PAYLOAD = {
  session: {
    type: "realtime",
    model: "gpt-realtime-2.1",
    instructions: JEWFREN_INSTRUCTIONS,
    audio: {
      input: {
        format: {
          type: "audio/pcm",
          rate: 24000
        },
        transcription: {
          model: "gpt-realtime-whisper"
        },
        noise_reduction: {
          type: "far_field"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          idle_timeout_ms: 10000
        }
      },
      output: {
        format: {
          type: "audio/pcm",
          rate: 24000
        },
        voice: "shimmer"
      }
    },
    output_modalities: [
      "audio"
    ],
    tools: [],
    max_output_tokens: "inf",
    reasoning: {
      "effort": "low"
    }
  }
};

// Production Grade Realtime Session Endpoint
// The API KEY IS ACCESSED STRICTLY FROM THE SERVER ENVIRONMENT VARIABLE (process.env.OPENAI_API_KEY)
// NEVER from request body, headers, or client browser.
app.post('/api/realtime-session', async (_req, res) => {
  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY is not configured on the server environment. Please set OPENAI_API_KEY in your server environment variables."
      });
    }

    // EXACT 100% PRODUCTION GRADE CURL CALL
    // curl https://api.openai.com/v1/realtime/client_secrets \
    //   -H "Content-Type: application/json" \
    //   -H "Authorization: Bearer $OPENAI_API_KEY" \
    //   -d '{ "session": ... }'
    const openAiResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(EXACT_CLIENT_SECRET_PAYLOAD),
    });

    const data = await openAiResponse.json();

    if (!openAiResponse.ok) {
      console.error('OpenAI Realtime Client Secrets API Error:', data);
      return res.status(openAiResponse.status).json({
        ok: false,
        error: data.error?.message || data.message || "Failed to initialize realtime session with OpenAI.",
        details: data
      });
    }

    const ephemeralKey = data.value || data.client_secret?.value || data.key;

    return res.json({
      ok: true,
      ephemeralKey,
      expiresAt: data.expires_at || null,
      session: data.session || null,
    });
  } catch (error: any) {
    console.error('Server error creating realtime session:', error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Internal server error connecting to OpenAI Realtime.",
    });
  }
});

// Production Grade Voice Turn Endpoint: Maintains back-and-forth conversation and returns spoken Shimmer audio
app.post('/api/chat-turn', async (req, res) => {
  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY is not configured on server." });
    }

    const { messages = [] } = req.body;

    // 1. Call OpenAI completions with the exact Jewfren prompt & full conversation session
    const compRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: JEWFREN_INSTRUCTIONS },
          ...messages,
        ],
        max_tokens: 120,
      }),
    });

    const compData = await compRes.json();
    if (!compRes.ok) {
      return res.status(compRes.status).json({ ok: false, error: compData.error?.message || "Failed to get reply." });
    }

    const replyText = compData.choices?.[0]?.message?.content || "I'm right here with you.";

    // 2. Generate spoken voice in Shimmer audio
    let audioDataUri: string | null = null;
    try {
      const speechRes = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'shimmer',
          input: replyText,
        }),
      });

      if (speechRes.ok) {
        const audioBuf = await speechRes.arrayBuffer();
        audioDataUri = `data:audio/mp3;base64,${Buffer.from(audioBuf).toString('base64')}`;
      }
    } catch (speechErr) {
      console.warn('Speech generation notice:', speechErr);
    }

    return res.json({
      ok: true,
      text: replyText,
      audioUrl: audioDataUri,
    });
  } catch (err: any) {
    console.error('Chat turn error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error processing voice turn.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Jewfren] Server running at http://localhost:${port}`);
  });
}

startServer();
