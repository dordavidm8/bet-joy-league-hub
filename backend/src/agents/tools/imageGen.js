const fs = require('fs');
const path = require('path');
const { agentsPool: pool } = require('../../config/database');

const OUTPUT_DIR = path.join(__dirname, '../../../../storage/media');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IMAGEN_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict';

async function generateImage({ prompt, runId, jobId, aspectRatio = '1:1' }) {
  if (!prompt) throw new Error('imageGen: No prompt provided');
  if (!GEMINI_API_KEY) throw new Error('imageGen: GEMINI_API_KEY env var is not set');

  console.log(`🖼️ imageGen: Generating image (Job: ${jobId})...`);

  await pool.query('UPDATE media_jobs SET status = $1, started_at = NOW() WHERE id = $2', ['rendering', jobId]);

  const response = await fetch(`${IMAGEN_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    const errorMsg = `imageGen: Gemini API error ${response.status}: ${errText}`;
    await pool.query('UPDATE media_jobs SET status = $1, error_log = $2, finished_at = NOW() WHERE id = $3', ['failed', errorMsg, jobId]);
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const base64 = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!base64) throw new Error('imageGen: No image data in Gemini response');

  const fileName = `infographic_${runId || Date.now()}.png`;
  const outputPath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'));

  const publicUrl = `/storage/media/${fileName}`;
  await pool.query('UPDATE media_jobs SET status = $1, output_url = $2, finished_at = NOW() WHERE id = $3', ['success', publicUrl, jobId]);

  console.log(`✅ imageGen: Image saved -> ${fileName}`);
  return { success: true, url: publicUrl, path: outputPath, fileName, mediaType: 'image' };
}

module.exports = { generateImage };
