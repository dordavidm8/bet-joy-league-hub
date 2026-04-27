const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const AUTH_STORAGE_PATH = path.join(__dirname, '../../../python/auth/notebooklm_cookies.json');
const authDir = path.dirname(AUTH_STORAGE_PATH);

// Global reference to keep the auth browser open across requests
let activeAuthContext = null;
let activeAuthBrowser = null;

async function runManualAuth(req, res) {
  if (activeAuthBrowser) {
    return res.json({ success: true, message: 'Auth session already active. Please use /confirm to save.' });
  }

  console.log('🦆 NotebookLM: Launching browser for manual auth...');
  try {
    activeAuthBrowser = await chromium.launch({ headless: false });
    activeAuthContext = await activeAuthBrowser.newContext();
    const page = await activeAuthContext.newPage();
    
    // Auto-cleanup after 15 minutes of inactivity
    setTimeout(async () => {
        if (activeAuthBrowser) {
            console.log('🧹 Auth Cleanup: Closing abandoned browser session...');
            await activeAuthBrowser.close();
            activeAuthBrowser = null;
            activeAuthContext = null;
        }
    }, 15 * 60 * 1000);

    await page.goto('https://notebooklm.google.com/');
    
    res.json({ 
      success: true, 
      message: 'Login window opened. PLEASE LOG IN manually, then call /api/agents/notebooklm/auth/confirm to save the session.' 
    });
  } catch (err) {
    console.error('❌ Auth Start Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function confirmAuth(req, res) {
  if (!activeAuthContext) {
    return res.status(400).json({ success: false, message: 'No active auth session. Call /auth first.' });
  }

  try {
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    
    console.log('💾 Saving Auth State to:', AUTH_STORAGE_PATH);
    await activeAuthContext.storageState({ path: AUTH_STORAGE_PATH });
    
    await activeAuthBrowser.close();
    activeAuthBrowser = null;
    activeAuthContext = null;
    
    res.json({ success: true, message: 'Auth session saved successfully. Agents can now operate autonomously.' });
  } catch (err) {
    console.error('❌ Confirm Auth Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { runManualAuth, confirmAuth };
