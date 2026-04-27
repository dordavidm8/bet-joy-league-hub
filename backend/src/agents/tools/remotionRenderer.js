const path = require('path');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const fs = require('fs');
const { agentsPool: pool } = require('../../config/database');

const REMOTION_PROJECT_PATH = path.join(__dirname, '../../../remotion/src/index.ts');
const OUTPUT_DIR = path.join(__dirname, '../../../../storage/media');

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let bundled = null;

async function getBundle() {
  if (bundled) return bundled;
  console.log('📦 Remotion: Bundling project...');
  // Remotion 4.x bundle API
  bundled = await bundle({
    entryPoint: REMOTION_PROJECT_PATH,
  });
  return bundled;
}

/**
 * Renders a video composition to MP4
 */
async function renderVideo(params) {
  const { compositionId, inputProps, jobId } = params;
  const compId = compositionId || 'MatchTeaser';
  const props = inputProps || {};

  try {
    console.log(`🎬 Remotion: Starting render for job ${jobId}...`);
    
    // Update status to rendering
    await pool.query('UPDATE media_jobs SET status = $1, started_at = NOW() WHERE id = $2', ['rendering', jobId]);

    const bundleLocation = await getBundle();
    const composition = await selectComposition({
      serveUrl: bundleLocation, // Fixed: Remotion 4+ uses serveUrl inside selectComposition
      id: compId,
      inputProps: props,
    });

    const fileName = `video_${compId}_${Date.now()}.mp4`;
    const outputLocation = path.join(OUTPUT_DIR, fileName);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation,
      inputProps: props,
    });

    const publicUrl = `/storage/media/${fileName}`;
    await pool.query('UPDATE media_jobs SET status = $1, output_url = $2, finished_at = NOW() WHERE id = $3', ['success', publicUrl, jobId]);

    return {
      success: true,
      url: publicUrl,
      path: outputLocation,
      fileName
    };
  } catch (err) {
    console.error('❌ Remotion Render Error:', err.message);
    if (jobId) {
      await pool.query('UPDATE media_jobs SET status = $1, error_log = $2, finished_at = NOW() WHERE id = $3', ['failed', err.message, jobId]);
    }
    throw err;
  }
}

module.exports = {
  renderVideo
};
