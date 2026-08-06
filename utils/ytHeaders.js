const fs = require('fs');
const path = require('path');

function getYouTubeCookies() {
  const env = process.env.YOUTUBE_COOKIES || process.env.YOUTUBE_COOKIE || '';
  if (env) return env;

  const cookieFile = path.join(__dirname, '..', 'cookies.txt');
  try {
    const txt = fs.readFileSync(cookieFile, 'utf8');
    return txt.split('\n').filter(l => !l.startsWith('#') && l.includes('youtube.com')).map(l => {
      const parts = l.split('\t');
      return parts[4] + '=' + parts[5];
    }).join('; ');
  } catch {
    return '';
  }
}

function getYouTubeHeaders() {
  const cookies = getYouTubeCookies();
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    ...(cookies ? { 'Cookie': cookies } : {}),
  };
}

module.exports = { getYouTubeHeaders };
