const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
// Render 會自動分配 Port，如果在本地則用 3000
const PORT = process.env.PORT || 3000;

// 【重要】從環境變數讀取資料庫連線字串，如果沒有則嘗試連本地 (方便您測試)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/xiaoyu_investment';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB 連線成功'))
    .catch(err => console.error('❌ MongoDB 連線失敗:', err));

const FileSchema = new mongoose.Schema({
    originalName: String,
    filename: String,
    path: String,
    uploadDate: { type: Date, default: Date.now }
});
const FileModel = mongoose.model('InvestmentFile', FileSchema);

// 注意：Render 免費版硬碟是暫時的，重啟後檔案會消失。
// 如果要永久存檔，通常會搭配 AWS S3 或 Cloudinary，但為了教學簡單我們維持原樣。
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>孝昱投資心得 - 雲端上傳版</title>
    <style>
        body { font-family: "Microsoft JhengHei", Arial, sans-serif; margin: 50px; background-color: #f4f4f4; text-align: center; }
        .container { background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); max-width: 600px; margin: 0 auto; }
        h1 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        form { display: flex; flex-direction: column; align-items: center; }
        input[type="file"] { margin: 20px 0; padding: 10px; border: 1px solid #ccc; border-radius: 4px; width: 80%; }
        button { padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; transition: background-color 0.3s; }
        button:hover { background-color: #0056b3; }
    </style>
</head>
<body>
    <div class="container">
        <h1>孝昱投資心得 (雲端版)</h1>
        <p>上傳您的 PDF 投資心得檔案。</p>
        <form action="/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="pdfFile" accept="application/pdf" required>
            <button type="submit">上傳檔案</button>
        </form>
    </div>
</body>
</html>
`;

app.get('/', (req, res) => res.send(htmlContent));

app.post('/upload', upload.single('pdfFile'), async (req, res) => {
    try {
        if (!req.file) return res.send('請選擇檔案');
        await FileModel.create({
            originalName: req.file.originalname,
            filename: req.file.filename,
            path: req.file.path
        });
        res.send(`<h2>✅ 上傳成功！已存入 MongoDB Atlas。</h2><a href="/">返回</a>`);
    } catch (error) {
        console.error(error);
        res.status(500).send('伺服器錯誤');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 伺服器運行於 Port ${PORT}`);
});