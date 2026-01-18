const express = require('express');
const multer = require('multer');
const cors = require('cors');
const exifr = require('exifr');
const { Pool } = require('pg'); 
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
// 开放 uploads 文件夹，让前端能通过 URL 访问图片
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 数据库连接配置
const pool = new Pool({
    user: 'postgres',        
    host: 'localhost',
    database: 'photo_gis',   
    password: '123456', 
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
        // 关键修改：添加 ORDER BY id ASC
        // 如果你将来解析了拍摄时间，这里最好改成 ORDER BY capture_time ASC
        const result = await pool.query(`
            SELECT id, name, path, ST_X(geom) as lng, ST_Y(geom) as lat 
            FROM photos 
            ORDER BY id ASC 
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("数据库查询失败");
    }
});

// 接口2：上传图片
app.post('/upload', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('无文件');
        
        const gps = await exifr.gps(req.file.path);
        // 如果没有 GPS，给个默认坐标或者报错，这里演示给个默认北京坐标
        const lng = gps ? gps.longitude : 116.40;
        const lat = gps ? gps.latitude : 39.90;

        const insertQuery = `
            INSERT INTO photos (name, path, geom)
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
            RETURNING id, name, path, ST_X(geom) as lng, ST_Y(geom) as lat
        `;
        
        const dbRes = await pool.query(insertQuery, [
            req.file.originalname, 
            req.file.path, 
            lng, 
            lat
        ]);

        res.json({ success: true, data: dbRes.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send('上传失败');
    }
});

app.listen(5000, () => console.log('Backend running on 5000'));