// server.js
import express from 'express';
import Database from 'better-sqlite3';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

// ==== Helper: normalizar texto (para comuna sin tildes) ====
function normalizeText(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')                 // separa tildes
    .replace(/[\u0300-\u036f]/g, '')  // elimina tildes (á→a, ú→u, etc.)
    .replace(/ñ/g, 'n')               // ñ → n (para Nunoa, Nunoa)
    .trim();
}

// __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PORT   = process.env.PORT   || 3000;
const dbFile = process.env.DB_FILE || './data/properties.db';

// asegurar carpeta de datos
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

// ===== DB =====
// La tabla `properties` la crea y llena el script de Python (import_inmobiliario.py)
const db = new Database(dbFile);

// ===== APP =====
const app = express();
app.use(morgan('dev'));
app.use(express.static('public'));

// ===============================
//  API: Buscar con filtros + paginación
// ===============================
app.get('/api/properties', (req, res) => {
  const {
    comuna, roomsMin, roomsMax, bathsMin, bathsMax,
    minM2, maxM2, minPrice, maxPrice,
    sort = 'price_asc', page = 1, pageSize = 12
  } = req.query;

  const where = [];
  const params = {};

  // Filtro por comuna (ignorando tildes/mayúsculas)
  if (comuna) {
    const comunaNorm = normalizeText(comuna);
    where.push(
      `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(comuna),
        'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u'),'ñ','n') LIKE @comunaNorm`
    );
    params.comunaNorm = `%${comunaNorm}%`;
  }

  // Filtros numéricos
  if (roomsMin) { where.push('rooms >= @roomsMin'); params.roomsMin = +roomsMin; }
  if (roomsMax) { where.push('rooms <= @roomsMax'); params.roomsMax = +roomsMax; }

  // IMPORTANTE: los nombres reales en la BD son bathrooms y area_m2
  if (bathsMin) {
    where.push('bathrooms >= @bathsMin');
    params.bathsMin = +bathsMin;
  }
  if (bathsMax) {
    where.push('bathrooms <= @bathsMax');
    params.bathsMax = +bathsMax;
  }

  if (minM2) {
    where.push('area_m2 >= @minM2');
    params.minM2 = +minM2;
  }
  if (maxM2) {
    where.push('area_m2 <= @maxM2');
    params.maxM2 = +maxM2;
  }

  if (minPrice) { where.push('price >= @minPrice'); params.minPrice = +minPrice; }
  if (maxPrice) { where.push('price <= @maxPrice'); params.maxPrice = +maxPrice; }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Ordenamiento
  let orderBy = 'price ASC';
  if (sort === 'price_desc') orderBy = 'price DESC';
  else if (sort === 'm2_desc')  orderBy = 'area_m2 DESC';
  else if (sort === 'm2_asc')   orderBy = 'area_m2 ASC';
  else if (sort === 'recent')   orderBy = 'id DESC'; // id como proxy de "reciente"

  const limit  = Math.max(1, Math.min(100, +pageSize || 12));
  const pageN  = Math.max(1, +page || 1);
  const offset = (pageN - 1) * limit;

  // SELECT con alias para que el front reciba baths y m2
  const items = db.prepare(
    `SELECT
       id,
       title,
       comuna,
       rooms,
       bathrooms AS baths,
       area_m2  AS m2,
       price,
       source,
       url
     FROM properties
     ${whereSql}
     ORDER BY ${orderBy}
     LIMIT @limit OFFSET @offset`
  ).all({ ...params, limit, offset });

  const total = db.prepare(
    `SELECT COUNT(*) AS c FROM properties ${whereSql}`
  ).get(params).c;

  res.json({ items, total, page: pageN, pageSize: limit });
});

// ===============================
//  Healthcheck
// ===============================
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ===============================
//  Detalle de propiedad
// ===============================
app.get('/api/properties/:id', (req, res) => {
  const id = Number(req.params.id);

  const row = db.prepare(`
    SELECT
      id,
      title,
      comuna,
      rooms,
      bathrooms AS baths,
      area_m2  AS m2,
      price,
      source,
      url
    FROM properties
    WHERE id = ?
  `).get(id);

  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Propiedades similares (misma comuna y habitaciones ±1)
app.get('/api/properties/:id/similar', (req, res) => {
  const id = Number(req.params.id);
  const base = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  if (!base) return res.json({ items: [] });

  const items = db.prepare(`
    SELECT
      id,
      title,
      comuna,
      rooms,
      bathrooms AS baths,
      area_m2  AS m2,
      price,
      source,
      url
    FROM properties
    WHERE id != @id
      AND comuna = @comuna
      AND rooms BETWEEN @rmin AND @rmax
    ORDER BY price ASC
    LIMIT 6
  `).all({
    id,
    comuna: base.comuna,
    rmin: (base.rooms ?? 0) - 1,
    rmax: (base.rooms ?? 0) + 1
  });

  res.json({ items });
});

// Servir la página de detalle en /p/:id
app.get('/p/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'property.html'));
});

// ===============================
//  Start server
// ===============================
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
