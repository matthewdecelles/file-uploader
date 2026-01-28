#!/usr/bin/env node
/**
 * One-time script to get a Google Drive refresh token.
 * Run this locally, authenticate in the browser, and save the refresh token.
 */
const http = require('http');
const { URL } = require('url');

const CLIENT_ID = '1083254377943-jtarft66i411oeqhb4kqh0kmkrp9fmrq.apps.googleusercontent.com';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET_HERE';
const REDIRECT_URI = 'http://localhost:3456/callback';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// Step 1: Build auth URL
const authUrl = `https://accounts.google.com/o/oauth2/auth?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent(SCOPES)}&` +
  `access_type=offline&` +
  `prompt=consent`;

console.log('\n🔗 Open this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for callback...\n');

// Step 2: Start local server to catch the callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3456`);
  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400);
    res.end('No code received');
    return;
  }

  // Step 3: Exchange code for tokens
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    
    if (tokens.error) {
      console.error('❌ Error:', tokens.error_description || tokens.error);
      res.writeHead(500);
      res.end('Error getting tokens: ' + JSON.stringify(tokens));
    } else {
      console.log('\n✅ Got tokens!\n');
      console.log('Refresh Token:', tokens.refresh_token);
      console.log('Access Token:', tokens.access_token?.substring(0, 30) + '...');
      console.log('\n📋 Save the refresh token to .env or Vercel env vars\n');
      
      // Save to file
      const fs = require('fs');
      const tokenFile = require('path').join(__dirname, '..', '.drive-token.json');
      fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));
      console.log(`💾 Saved to ${tokenFile}`);
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>✅ Success!</h1><p>You can close this tab. Check the terminal for your refresh token.</p>');
    }
  } catch (err) {
    console.error('❌ Fetch error:', err.message);
    res.writeHead(500);
    res.end('Error: ' + err.message);
  }

  server.close();
});

server.listen(3456, () => {
  // Try to open browser automatically
  const { exec } = require('child_process');
  exec(`open "${authUrl}"`);
});
