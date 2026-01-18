-- 数据库结构备份
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE photos (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    path TEXT,
    geom GEOMETRY(Point, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_photos_geom ON photos USING GIST (geom);