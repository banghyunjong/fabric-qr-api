// .env 파일 로드 (로컬 개발용)
// Vercel에서는 환경 변수가 자동으로 주입되므로 이 라인은 Vercel 배포 시에는 영향을 주지 않습니다.
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
// PORT는 로컬 개발 환경에서만 사용되며, Vercel에서는 무시됩니다.
const PORT = process.env.PORT || 5000;

// CORS 설정: Vercel 배포 시 CLIENT_URL 환경 변수를 사용합니다.
// CLIENT_URL은 Vercel 프로젝트 환경 변수에 설정해야 합니다.
app.use(cors({
    origin: "*",
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// JSON 요청 본문 파싱 미들웨어
app.use(express.json());

// MongoDB 연결
// MONGO_URI 환경 변수는 Vercel 프로젝트 환경 변수에 설정해야 합니다.
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
    console.error('FATAL ERROR: MONGO_URI is not defined in environment variables.');
    // Vercel 환경에서는 이 오류가 발생하지 않도록 MONGO_URI를 반드시 설정해야 합니다.
} else {
    mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('MongoDB에 성공적으로 연결되었습니다.'))
    .catch(err => console.error('MongoDB 연결 오류:', err));
}

// MongoDB 스키마 및 모델 정의
const materialSchema = new mongoose.Schema({
    qrCodeId: { type: String, required: true, unique: true },
    materialName: { type: String, required: true },
    materialType: String,
    color: String,
    manufacturer: String,
    productionDate: String,
    features: [String],
    careInstructions: String,
    imageUrl: String
});
const Material = mongoose.model('Material', materialSchema);


// API 엔드포인트: QR 코드 ID로 소재 정보 조회
// Vercel에서는 이 경로가 서버리스 함수의 엔드포인트가 됩니다.
// 'api/' 접두사를 사용하지 않는 것이 Vercel의 권장 사항입니다.
app.get('/materials/:qrCodeId', async (req, res) => {
    const qrCodeId = req.params.qrCodeId;
    console.log(`QR 코드 ID로 소재 정보 조회 요청: ${qrCodeId}`);

    try {
        const material = await Material.findOne({ qrCodeId: qrCodeId });
        if (material) {
            res.json(material);
        } else {
            console.log(`QR 코드 ID '${qrCodeId}'에 해당하는 소재 정보를 찾을 수 없습니다.`);
            res.status(404).json({ message: '소재 정보를 찾을 수 없습니다.' });
        }
    } catch (error) {
        console.error('소재 정보 조회 중 서버 오류 발생:', error);
        res.status(500).json({ message: '서버 오류 발생', error: error.message });
    }
});

// 루트 경로에 대한 응답 (선택 사항)
// 이 경로는 Vercel 배포 시 `https://[your-domain].vercel.app/` 으로 접근할 때 응답합니다.
app.get('/', (req, res) => {
    res.status(200).json({
        message: "Fabric QR Server API is running!",
        routes: {
            getMaterialById: "/materials/:qrCodeId"
        }
    });
});

// Vercel 서버리스 함수로 내보내기 위한 핵심 부분
// 이 라인이 Express 앱 인스턴스를 Vercel 런타임이 실행할 수 있도록 만듭니다.
module.exports = app;

// 로컬 개발 환경에서만 서버를 리스닝 (Vercel에서는 이 블록은 실행되지 않습니다.)
// Vercel은 'module.exports = app;'을 사용하여 서버를 시작합니다.
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}