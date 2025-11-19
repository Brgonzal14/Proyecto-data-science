import pandas as pd
import sqlite3
from pathlib import Path

# ============================
# 1. RUTAS
# ============================
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "properties.db"
EXCEL_PATH = BASE_DIR / "data" / "inmobiliario_limpio_v4.xlsx"

print(f"Usando Excel: {EXCEL_PATH}")
print(f"Base de datos: {DB_PATH}")

# ============================
# 2. LEER EXCEL
# ============================
df = pd.read_excel(EXCEL_PATH)

# Nos quedamos con las columnas que nos interesan para el front
# (ya revisé tu archivo y existen con estos nombres)
df_simple = df[[
    "Source.Name",   # portal origen
    "titulo",        # título del aviso
    "link",          # URL del aviso
    "comuna",        # comuna
    "dormitorios",   # n° dormitorios
    "banos",         # n° baños
    "sup_total",     # m2 totales
    "precio_en_uf"   # precio en UF
]].copy()

# Renombramos a nombres más "limpios" para la BD y la API
df_simple = df_simple.rename(columns={
    "Source.Name": "source",
    "titulo": "title",
    "link": "url",
    "comuna": "comuna",
    "dormitorios": "rooms",
    "banos": "bathrooms",
    "sup_total": "area_m2",
    "precio_en_uf": "price"
})

# Opcional: eliminar filas sin comuna o sin precio
df_simple = df_simple.dropna(subset=["comuna", "price"])

print(f"Filas a insertar: {len(df_simple)}")

# ============================
# 3. CONECTAR A SQLITE
# ============================
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# ⚠️ IMPORTANTE: borrar la tabla anterior y crearla de nuevo
cur.execute("DROP TABLE IF EXISTS properties")

cur.execute("""
CREATE TABLE properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT,
    title TEXT,
    url TEXT,
    comuna TEXT,
    rooms INTEGER,
    bathrooms INTEGER,
    area_m2 REAL,
    price REAL
)
""")
conn.commit()

# ============================
# 4. INSERTAR DATOS
# ============================

cols = ["source", "title", "url", "comuna", "rooms", "bathrooms", "area_m2", "price"]
df_to_insert = df_simple[cols].copy()

df_to_insert.to_sql(
    "properties",
    conn,
    if_exists="append",
    index=False
)

conn.close()
print("✅ Datos importados a data/properties.db en la tabla 'properties'")

