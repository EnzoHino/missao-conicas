const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'ranking.json');

/*
  DB structure:
  {
    valendo: [ { nome, ra, pontos, pontos_final, max_pts, tempo_segundos, tentativa, estrelas, criado_em }, ... ],
    teste:   [ ... ]
  }
*/
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {}
  return { valendo: [], teste: [] };
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ── POST /api/score ── */
app.post('/api/score', (req, res) => {
  const { nome, ra, pontos, pontos_final, max_pts, tempo_segundos, estrelas, is_teste } = req.body;

  if (!nome || !ra || pontos === undefined || pontos_final === undefined || !estrelas)
    return res.status(400).json({ error: 'Campos obrigatórios: nome, ra, pontos, pontos_final, estrelas' });

  if (!/^\d{6}$/.test(String(ra)))
    return res.status(400).json({ error: 'RA deve ter exatamente 6 dígitos.' });

  const nomeTrim = String(nome).trim().slice(0, 60);
  const raTrim   = String(ra).trim();
  const bucket   = is_teste ? 'teste' : 'valendo';

  try {
    const db = loadDB();

    // count previous attempts by this RA in this bucket
    const prevAttempts = db[bucket].filter(r => r.ra === raTrim).length;
    const tentativa = prevAttempts + 1;

    db[bucket].push({
      nome: nomeTrim,
      ra: raTrim,
      pontos: Number(pontos),
      pontos_final: Number(pontos_final),
      max_pts: Number(max_pts) || 1630,
      tempo_segundos: Number(tempo_segundos) || 0,
      tentativa,
      estrelas: String(estrelas),
      criado_em: new Date().toISOString()
    });

    saveDB(db);
    res.json({ ok: true, tentativa });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar pontuação.' });
  }
});

/* ── GET /api/ranking?teste=0&filtro=todas|melhor ── */
app.get('/api/ranking', (req, res) => {
  const bucket = req.query.teste === '1' ? 'teste' : 'valendo';
  const filtro = req.query.filtro === 'melhor' ? 'melhor' : 'todas';

  try {
    const db = loadDB();
    let rows = [...db[bucket]];

    if (filtro === 'melhor') {
      // keep only best pontos_final per RA
      const best = {};
      for (const r of rows) {
        if (!best[r.ra] || r.pontos_final > best[r.ra].pontos_final) {
          best[r.ra] = r;
        }
      }
      rows = Object.values(best);
    }

    rows.sort((a, b) => b.pontos_final - a.pontos_final || a.tempo_segundos - b.tempo_segundos);
    rows = rows.slice(0, 20);

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
