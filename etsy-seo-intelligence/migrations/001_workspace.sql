CREATE TABLE IF NOT EXISTS etsy_reports (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  keyword text NOT NULL,
  report jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS etsy_reports_created_idx ON etsy_reports (created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS etsy_analysis_quota (
  day date PRIMARY KEY,
  day_count integer NOT NULL CHECK (day_count > 0),
  hour_start timestamptz NOT NULL,
  hour_count integer NOT NULL CHECK (hour_count > 0)
);
