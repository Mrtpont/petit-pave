-- Schéma de la base Petit Pavé
-- À exécuter une seule fois dans l'onglet "Console" de ta base D1 sur Cloudflare
-- (Workers & Pages > Storage & Databases > D1 > ta base > Console)

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  comment TEXT,
  photo TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'ouvert',
  created_at TEXT NOT NULL,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports (created_at);
CREATE INDEX IF NOT EXISTS idx_reports_ip_hash ON reports (ip_hash);
