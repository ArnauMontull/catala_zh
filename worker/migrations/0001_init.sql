-- Tarjetas de repaso sincronizadas. `code` es el código de acceso (= sync_id).
-- front y fsrs se guardan como JSON en texto; el Worker no los interpreta.
CREATE TABLE IF NOT EXISTS cards (
  code       TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  front      TEXT    NOT NULL,
  fsrs       TEXT    NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (code, id)
);

-- GET /sync?since= filtra por código y updated_at.
CREATE INDEX IF NOT EXISTS idx_cards_code_updated ON cards (code, updated_at);
