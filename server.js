import express from 'express';
import Database from 'better-sqlite3';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const dbFile = process.env.DB_FILE || './data/properties.db';

// Asegurar carpeta de datos
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

// Inicializar DB
const db = new Database(dbFile);

// Esquema + datos de ejemplo
db.exec(`
CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  comuna TEXT,
  address TEXT,
  price REAL NOT NULL,
  currency TEXT DEFAULT 'CLP',
  rooms INTEGER,
  baths INTEGER,
  m2 INTEGER,
  parking INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

const countRow = db.prepare('SELECT COUNT(*) AS c FROM properties').get();
if (countRow.c === 0) {
  const insert = db.prepare(`
    INSERT INTO properties (title, comuna, address, price, currency, rooms, baths, m2, parking)
    VALUES (@title, @comuna, @address, @price, @currency, @rooms, @baths, @m2, @parking)
  `);
  const sample = [
    {title:'Depto 2D/1B cerca Metro Ñuble', comuna:'Ñuñoa', address:'Calle A 123', price: 4200, currency:'UF', rooms:2, baths:1, m2:55, parking:1},
    {title:'Casa familiar 3D/2B', comuna:'Maipú', address:'Pasaje B 456', price: 120000000, currency:'CLP', rooms:3, baths:2, m2:90, parking:1},
    {title:'Studio 1D/1B', comuna:'Santiago Centro', address:'Moneda 1000', price: 2500, currency:'UF', rooms:1, baths:1, m2:32, parking:0},
    {title:'Depto 4D/3B con bodega', comuna:'Las Condes', address:'Apoquindo 4500', price: 9800, currency:'UF', rooms:4, baths:3, m2:140, parking:2},
    {title:'Departamento 2D/2B', comuna:'Providencia', address:'Providencia 123', price: 5500, currency:'UF', rooms:2, baths:2, m2:70, parking:1},
    {title:'Casa 5D/3B patio grande', comuna:'La Florida', address:'Walker 1212', price: 185000000, currency:'CLP', rooms:5, baths:3, m2:160, parking:2}
  ];
  const insertMany = db.transaction(rows => rows.forEach(r => insert.run(r)));
  insertMany(sample);
}

// 👇 CREA app ANTES de usar app.use
const app = express();

app.use(morgan('dev'));
app.use(express.static('public'));

// API de búsqueda
app.get('/api/properties', (req, res) => {
  const {
    comuna, roomsMin, roomsMax, bathsMin, bathsMax,
    minM2, maxM2, minPrice, maxPrice, currency,
    sort = 'price_asc', page = 1, pageSize = 12
  } = req.query;

  const where = [];
  const params = {};

  if (comuna)   { where.push('LOWER(comuna) LIKE LOWER(@comuna)'); params.comuna = `%${comuna}%`; }
  if (roomsMin) { where.push('rooms >= @roomsMin'); params.roomsMin = +roomsMin; }
  if (roomsMax) { where.push('rooms <= @roomsMax'); params.roomsMax = +roomsMax; }
  if (bathsMin) { where.push('baths >= @bathsMin'); params.bathsMin = +bathsMin; }
  if (bathsMax) { where.push('baths <= @bathsMax'); params.bathsMax = +bathsMax; }
  if (minM2)    { where.push('m2 >= @minM2'); params.minM2 = +minM2; }
  if (maxM2)    { where.push('m2 <= @maxM2'); params.maxM2 = +maxM2; }
  if (currency) { where.push('currency = @currency'); params.currency = String(currency).toUpperCase(); }
  if (minPrice) { where.push('price >= @minPrice'); params.minPrice = +minPrice; }
  if (maxPrice) { where.push('price <= @maxPrice'); params.maxPrice = +maxPrice; }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  let orderBy = 'price ASC';
  if (sort === 'price_desc') orderBy = 'price DESC';
  else if (sort === 'm2_desc') orderBy = 'm2 DESC';
  else if (sort === 'm2_asc')  orderBy = 'm2 ASC';
  else if (sort === 'recent')  orderBy = 'datetime(created_at) DESC';

  const limit = Math.max(1, Math.min(100, +pageSize || 12));
  const pageNum = Math.max(1, +page || 1);
  const offset = (pageNum - 1) * limit;

  const items = db.prepare(
    `SELECT * FROM properties ${whereSql} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`
  ).all({ ...params, limit, offset });

  const total = db.prepare(
    `SELECT COUNT(*) AS c FROM properties ${whereSql}`
  ).get(params).c;

  res.json({ items, total, page: pageNum, pageSize: limit });
});

// Healthcheck
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
