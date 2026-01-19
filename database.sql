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

-- 添加 capture_time 字段
ALTER TABLE photos ADD COLUMN capture_time TIMESTAMP;

-- 清空旧数据（强烈建议！因为旧数据没有拍摄时间，会打乱排序）
TRUNCATE TABLE photos RESTART IDENTITY;