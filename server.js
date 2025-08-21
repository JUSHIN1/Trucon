// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const POSTS_MD = path.join(__dirname, 'posts.md');

// ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ likes: {}, stars: {}, shares: {}, comments: {} }, null, 2));
}

// helper to read/write data.json
function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return { likes: {}, stars: {}, shares: {}, comments: {} }; }
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from current directory (index.html, posts.md, images folder etc.)
app.use(express.static(path.join(__dirname)));

// Simple ping to check server availability
app.get('/api/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Serve the raw posts.md (so client can still fetch it)
app.get('/api/posts-md', (req, res) => {
  if (fs.existsSync(POSTS_MD)) {
    res.type('text/markdown').send(fs.readFileSync(POSTS_MD, 'utf8'));
  } else {
    res.status(404).json({ error: 'posts.md not found' });
  }
});

// Return parsed posts (basic parse using same front matter format as client)
app.get('/api/posts', (req, res) => {
  if (!fs.existsSync(POSTS_MD)) return res.json([]);
  const md = fs.readFileSync(POSTS_MD, 'utf8');
  const blocks = md.split(/^---\s*$/m).map(b => b.trim()).filter(Boolean);
  const posts = blocks.map((block, idx) => {
    const lines = block.split(/\r?\n/);
    let meta = {}, i=0;
    while(i < lines.length && lines[i].trim() !== ''){
      const m = lines[i].match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
      if (m) { meta[m[1].toLowerCase()] = m[2].trim(); i++; } else break;
    }
    let contentLines = lines.slice(i);
    if (contentLines[0] === '') contentLines = contentLines.slice(1);
    const content = contentLines.join('\n').trim();
    return {
      id: idx,
      title: meta.title || '',
      date: meta.date || '',
      category: (meta.category || '').toLowerCase(),
      image: meta.image || '',
      content
    };
  }).reverse();
  res.json(posts);
});

// Data endpoints: likes, stars, shares, comments
app.get('/api/post/:id/stats', (req, res) => {
  const id = String(req.params.id);
  const data = readData();
  res.json({
    likes: data.likes[id] || 0,
    stars: data.stars[id] || 0,
    shares: data.shares[id] || 0,
    comments: data.comments[id] || []
  });
});

app.post('/api/post/:id/like', (req, res) => {
  const id = String(req.params.id);
  const data = readData();
  data.likes[id] = (data.likes[id] || 0) + 1;
  writeData(data);
  res.json({ ok: true, likes: data.likes[id] });
});

app.post('/api/post/:id/star', (req, res) => {
  const id = String(req.params.id);
  const data = readData();
  data.stars[id] = (data.stars[id] || 0) + 1;
  writeData(data);
  res.json({ ok: true, stars: data.stars[id] });
});

app.post('/api/post/:id/unstar', (req, res) => {
  const id = String(req.params.id);
  const data = readData();
  data.stars[id] = Math.max(0, (data.stars[id] || 0) - 1);
  writeData(data);
  res.json({ ok: true, stars: data.stars[id] });
});

app.post('/api/post/:id/share', (req, res) => {
  const id = String(req.params.id);
  const data = readData();
  data.shares[id] = (data.shares[id] || 0) + 1;
  writeData(data);
  res.json({ ok: true, shares: data.shares[id] });
});

app.post('/api/post/:id/comment', (req, res) => {
  const id = String(req.params.id);
  const { name, avatar, text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty comment' });
  const data = readData();
  const comment = { name: name || 'you', avatar: avatar || '', text: text.trim(), ts: Date.now() };
  data.comments[id] = data.comments[id] || [];
  data.comments[id].push(comment);
  writeData(data);
  res.json({ ok:true, comment, total: data.comments[id].length });
});

// Simple endpoint to return all data (for admin/dev)
app.get('/api/debug/data', (req, res) => res.json(readData()));

// start server
app.listen(PORT, ()=> {
  console.log(`TruthBeacon server running on http://localhost:${PORT}`);
});




