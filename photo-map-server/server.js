const express = require('express');
const multer = require('multer');
const cors = require('cors');
const exifr = require('exifr');
const { Pool } = require('pg'); 
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 数据库连接配置
const pool = new Pool({
    user: 'postgres',        
    host: 'localhost',
    database: 'photo_gis',   
    password: '123456', // <--- 请确认这里是正确的密码
    port: 5432,
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// 接口1：获取地图数据
app.get('/photos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, path, capture_time, ST_X(geom) as lng, ST_Y(geom) as lat 
            FROM photos 
            ORDER BY capture_time ASC 
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("数据库查询失败");
    }
});

// 接口2：上传图片 (修复了这里！)
app.post('/upload', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('无文件');
        
        // --- 修复点 1：改用 parse 获取全部元数据 (包括时间) ---
        const exifData = await exifr.parse(req.file.path);
        
        const lng = exifData && exifData.longitude ? exifData.longitude : 116.40;
        const lat = exifData && exifData.latitude ? exifData.latitude : 39.90;
        
        // --- 修复点 2：提取拍摄时间 ---
        const captureTime = exifData && exifData.DateTimeOriginal ? exifData.DateTimeOriginal : new Date();

        // --- 修复点 3：插入语句加入 capture_time ---
        const insertQuery = `
            INSERT INTO photos (name, path, geom, capture_time)
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5)
            RETURNING id, name, path, ST_X(geom) as lng, ST_Y(geom) as lat, capture_time
        `;
        
        const dbRes = await pool.query(insertQuery, [
            req.file.originalname, 
            req.file.path, 
            lng, 
            lat,
            captureTime // 对应 $5
        ]);

        res.json({ success: true, data: dbRes.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send('上传失败');
    }
});

// 接口3:空间查询接口
app.get('/photos/search', async (req, res) => {
    try {
        const { lng, lat, distance = 5000 } = req.query; 

        if (!lng || !lat) return res.status(400).send("缺少经纬度参数");

        const query = `
            SELECT id, name, path, capture_time, ST_X(geom) as lng, ST_Y(geom) as lat 
            FROM photos
            WHERE ST_DWithin(
                geom::geography, 
                ST_MakePoint($1, $2)::geography, 
                $3
            )
            ORDER BY capture_time ASC;
        `;
        
        const result = await pool.query(query, [lng, lat, distance]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("空间查询失败");
    }
});

app.listen(5000, () => console.log('Backend running on 5000'));