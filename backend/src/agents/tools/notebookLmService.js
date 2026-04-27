const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { agentsPool: pool } = require('../../config/database');

// Use process.env.PYTHON_BIN or fallback to 'python3' (better for Railway/Linux)
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const PYTHON_BRIDGE = path.join(__dirname, '../../../python/notebooklm_bridge.py');
const OUTPUT_DIR = path.join(__dirname, '../../../../storage/media');

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * NotebookLM Service
 * Secure execution of Python bridge for podcast generation.
 */
async function _runBridge(mode, content, ext, runId, jobId) {
  const fileName = `${mode}_${runId || Date.now()}.${ext}`;
  const outputPath = path.join(OUTPUT_DIR, fileName);

  await pool.query('UPDATE media_jobs SET status = $1, started_at = NOW() WHERE id = $2', ['rendering', jobId]);

  return new Promise((resolve, reject) => {
    const pyProcess = spawn(PYTHON_BIN, [PYTHON_BRIDGE, '--mode', mode, '--text', content, '--out', outputPath]);

    let errorOutput = '';

    const timeout = setTimeout(() => {
      pyProcess.kill('SIGKILL');
      reject(new Error(`NotebookLM (${mode}): Generation timed out after 15 minutes`));
    }, 15 * 60 * 1000);

    pyProcess.stdout.on('data', (data) => console.log(`[NotebookLM/${mode}]: ${data}`));
    pyProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[NotebookLM/${mode} Stderr]: ${data}`);
    });

    pyProcess.on('close', async (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        const errorMsg = `NotebookLM (${mode}) failed with code ${code}. Error: ${errorOutput}`;
        await pool.query('UPDATE media_jobs SET status = $1, error_log = $2, finished_at = NOW() WHERE id = $3', ['failed', errorMsg, jobId]);
        return reject(new Error(errorMsg));
      }

      const publicUrl = `/storage/media/${fileName}`;
      await pool.query('UPDATE media_jobs SET status = $1, output_url = $2, finished_at = NOW() WHERE id = $3', ['success', publicUrl, jobId]);

      resolve({ success: true, url: publicUrl, path: outputPath, fileName });
    });
  });
}

const NotebookLMService = {
  async generateAudio(params) {
    const { sourceText, text, runId, jobId } = params;
    const content = sourceText || text;
    if (!content) throw new Error('NotebookLM: No source text provided');
    console.log(`🎧 NotebookLM: Starting podcast generation (Job: ${jobId})...`);
    return _runBridge('audio', content, 'mp3', runId, jobId);
  },

  async generateSlides(params) {
    const { sourceText, text, runId, jobId } = params;
    const content = sourceText || text;
    if (!content) throw new Error('NotebookLM: No source text provided');
    console.log(`🎞️ NotebookLM: Starting slide deck generation (Job: ${jobId})...`);
    return _runBridge('slides', content, 'pdf', runId, jobId);
  }
};

module.exports = NotebookLMService;
