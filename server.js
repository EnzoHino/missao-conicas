const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'ranking.json');

/* ── JSON "DATABASE" ──
   Structure: { valendo: { [nome]: {nome,pontos,max_pts,estrelas,criado_em} },
                teste:   { [nome]: {...} } }
*/
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {}
  return { valendo: {}, teste: {} };
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/* ── MIDDLEWARE ── */
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ── POST /api/score ── */
app.post('/api/score', (req, res) => {
  const { nome, pontos, max_pts, estrelas, is_teste } = req.body;
  if (!nome || pontos === undefined || !estrelas)
    return res.status(400).json({ error: 'Campos obrigatórios: nome, pontos, estrelas' });

  const key   = String(nome).trim().slice(0, 60);
  const bucket = is_teste ? 'teste' : 'valendo';

  try {
    const db = loadDB();
    const existing = db[bucket][key];
    // keep only best score per player
    if (!existing || pontos > existing.pontos) {
      db[bucket][key] = {
        nome: key,
        pontos: Number(pontos),
        max_pts: Number(max_pts) || 1630,
        estrelas: String(estrelas),
        criado_em: new Date().toISOString()
      };
      saveDB(db);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar pontuação.' });
  }
});

/* ── GET /api/ranking?teste=0 ── */
app.get('/api/ranking', (req, res) => {
  const bucket = req.query.teste === '1' ? 'teste' : 'valendo';
  try {
    const db   = loadDB();
    const rows = Object.values(db[bucket])
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, 20);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar ranking.' });
  }
});

/* ── SPA FALLBACK ── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Engenheiro Espacial v3 rodando em http://localhost:${PORT}`);
});
