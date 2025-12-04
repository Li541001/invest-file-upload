require('dotenv').config(); // 載入 .env 設定

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/xiaoyu_investment';

// 1. 連接 MongoDB
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB 連線成功');
        // 只有連線成功才啟動伺服器
        app.listen(PORT, () => {
            console.log(`🚀 伺服器運行於 Port ${PORT}`);
        });
    })
    .catch(err => console.error('❌ MongoDB 連線失敗:', err));

// 2. 修改 Schema：加入 data (Buffer) 來存檔案內容
const FileSchema = new mongoose.Schema({
    originalName: String,
    contentType: String, // 紀錄檔案類型 (例如 application/pdf)
    data: Buffer,        // <--- 這裡就是真正的檔案內容
    uploadDate: { type: Date, default: Date.now }
});

const FileModel = mongoose.model('InvestmentFile', FileSchema);

// 3. 修改 Multer：使用記憶體儲存 (MemoryStorage)
// 這樣 req.file.buffer 才會拿到資料
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 限制 15MB (MongoDB 單一文件上限是 16MB)
});

// --- 路由設定 ---

// 首頁：顯示上傳表單 + 已上傳的檔案列表
app.get('/', async (req, res) => {
    // 從資料庫撈出所有檔案的「名稱」和「ID」(不要撈 data，不然網頁會跑不動)
    const files = await FileModel.find({}, 'originalName _id uploadDate').sort({ uploadDate: -1 });

    const fileListHtml = files.map(file => `
        <li style="margin: 10px 0; padding: 10px; background: #eee; border-radius: 5px; list-style: none;">
            <span>📄 ${file.originalName}</span>
            <a href="/file/${file._id}" target="_blank" style="margin-left: 10px; color: blue;">查看/下載</a>
        </li>
    `).join('');

    const html = `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>孝昱投資心得</title>
        <style>
            body { font-family: "Microsoft JhengHei", sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; text-align: center; }
            form { margin: 20px 0; padding: 20px; border: 2px dashed #ccc; }
            ul { padding: 0; text-align: left; }
        </style>
    </head>
    <body>
        <h1>孝昱投資心得</h1>
        
        <form action="/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="pdfFile" accept="application/pdf" required>
            <button type="submit">上傳到資料庫</button>
        </form>

        <h3>已上傳的檔案：</h3>
        <ul>${fileListHtml || '<p>目前沒有檔案</p>'}</ul>
    </body>
    </html>
    `;
    res.send(html);
});

// 上傳路由：將 Buffer 存入 DB
app.post('/upload', upload.single('pdfFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('請選擇檔案');

        // 建立新文件，將記憶體中的 buffer 存進去
        await FileModel.create({
            originalName: req.file.originalname,
            contentType: req.file.mimetype,
            data: req.file.buffer 
        });

        res.redirect('/'); // 上傳完直接回首頁
    } catch (error) {
        console.error(error);
        res.status(500).send(`上傳失敗：檔案可能過大 (限制 16MB) 或資料庫錯誤`);
    }
});

// 讀取路由：從 DB 撈出 Buffer 並還原成檔案
app.get('/file/:id', async (req, res) => {
    try {
        const file = await FileModel.findById(req.params.id);
        if (!file) return res.status(404).send('找不到檔案');

        // 設定標頭，告訴瀏覽器這是一個 PDF
        res.set('Content-Type', file.contentType);
        // 將二進位資料送出
        res.send(file.data);
    } catch (error) {
        res.status(500).send('讀取錯誤');
    }
});