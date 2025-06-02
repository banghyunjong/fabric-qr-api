// .env 파일 로드 (로컬 개발용)
// Vercel에서는 환경 변수가 자동으로 주입되므로 이 라인은 Vercel 배포 시에는 영향을 주지 않습니다.
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // <-- 새로 추가: JWT 토큰 생성을 위해
const bcrypt = require('bcryptjs'); // <-- 새로 추가: 비밀번호 비교를 위해

// --- 새로 추가: 인증 미들웨어 불러오기 ---
const { auth, authorizeAdmin } = require('./middleware/auth');

const app = express();
// PORT는 로컬 개발 환경에서만 사용되며, Vercel에서는 무시됩니다.
const PORT = process.env.PORT || 5000;

// CORS 설정 업데이트:
// 모바일 클라이언트의 Vercel 배포 URL을 명시적으로 허용합니다.
// 또한, 로컬 개발 환경을 위해 localhost:3000도 함께 허용합니다.
// process.env.CLIENT_URL 환경 변수를 사용하여 Vercel에 배포된 클라이언트 URL을 지정할 수 있습니다.
const allowedOrigins = [
    'https://fabric-qr-system.vercel.app', // <-- 당신의 모바일 클라이언트 Vercel 도메인!
    'https://fabric-admin-dashborad.vercel.app', // <-- 관리자 대시보드 도메인 추가
    'http://localhost:3000', // 로컬 개발용
    'http://localhost:5000', // 백엔드 로컬 테스트용 (선택 사항)
    // admin-dashboard 클라이언트도 추가해야 한다면 여기에 추가
    // 'https://your-admin-dashboard.vercel.app',
];



// CORS 설정: Vercel 배포 시 CLIENT_URL 환경 변수를 사용합니다.
// CLIENT_URL은 Vercel 프로젝트 환경 변수에 설정해야 합니다.
app.use(cors({
    origin: function (origin, callback) {
        // 요청의 origin이 allowedOrigins 배열에 있거나 origin이 없는 경우 (예: Postman 요청) 허용
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // <-- 중요: 인증 정보를 포함한 요청(쿠키, Authorization 헤더 등)을 허용
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


// ------------------------------------------------------------------
// --- 새로 추가되는 User 모델 정의 불러오기 (models/User.js에서) ---
// ------------------------------------------------------------------
const User = require('./models/User'); // User.js 파일 경로에 맞춰 수정

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



// JWT Secret Key (보안: 실제 서비스에서는 .env 파일에 따로 관리해야 합니다!)
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'; // <-- Vercel 환경 변수에 JWT_SECRET 추가 권장

// 1. 일반 ID/PW 로그인 엔드포인트
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`로그인 요청: ${username}`);

    try {
        // 1. 사용자 조회
        const user = await User.findOne({ username });
        if (!user) {
            console.log(`존재하지 않는 사용자: ${username}`);
            return res.status(401).json({ message: '사용자 이름 또는 비밀번호가 올바르지 않습니다.' });
        }

        // 2. 비밀번호 확인
        // bcrypt.compare 대신 User 모델에 정의된 comparePassword 메서드 사용
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log(`비밀번호 불일치: ${username}`);
            return res.status(401).json({ message: '사용자 이름 또는 비밀번호가 올바르지 않습니다.' });
        }

        // 3. JWT 토큰 생성
        const token = jwt.sign(
            { userId: user._id, isAdmin: user.isAdmin, canScanQr: user.canScanQr },
            JWT_SECRET,
            { expiresIn: '1h' } // 토큰 유효기간 1시간
        );

        // 4. 토큰과 사용자 정보 (비밀번호 제외) 반환
        res.status(200).json({
            message: '로그인 성공',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                canScanQr: user.canScanQr,
                isAdmin: user.isAdmin
            }
        });

    } catch (error) {
        console.error('로그인 중 서버 오류 발생:', error);
        res.status(500).json({ message: '서버 오류 발생', error: error.message });
    }
});

// 2. 구글 로그인 사용자 정보 저장/업데이트 엔드포인트
app.post('/auth/google-login', async (req, res) => {
    const { googleId, email, name } = req.body;
    console.log(`구글 로그인 정보 수신: ${email} (ID: ${googleId})`);

    try {
        let user = await User.findOne({ googleId });

        if (user) {
            // 기존 사용자: 정보 업데이트 (필요하다면)
            user.email = email; // 이메일은 업데이트될 수 있음
            user.username = user.username || email.split('@')[0]; // 사용자 이름이 없으면 이메일 앞부분으로 설정
            // canScanQr 등의 권한은 관리자 사이트에서 관리되므로 여기서 기본값으로 설정하거나, 업데이트 로직 필요
            await user.save();
            console.log(`기존 구글 사용자 정보 업데이트: ${email}`);
        } else {
            // 새로운 사용자: 생성
            user = new User({
                googleId,
                email,
                username: email.split('@')[0], // 사용자 이름 기본값 설정 (중복 가능성 고려)
                // 비밀번호는 구글 로그인 사용자이므로 필요 없음 (User 스키마의 required 함수 참고)
                canScanQr: false, // 기본적으로 QR 스캔 권한 없음
                isAdmin: false // 관리자 아님
            });
            await user.save();
            console.log(`새로운 구글 사용자 생성: ${email}`);
        }

        // 구글 로그인 사용자를 위한 JWT 토큰 발급 (클라이언트 앱에서 사용)
        const token = jwt.sign(
            { userId: user._id, isAdmin: user.isAdmin, canScanQr: user.canScanQr },
            JWT_SECRET,
            { expiresIn: '7d' } // 구글 로그인 토큰은 더 길게 설정할 수 있음
        );

        res.status(200).json({
            message: '구글 로그인 정보 처리 성공',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                canScanQr: user.canScanQr,
                isAdmin: user.isAdmin
            }
        });

    } catch (error) {
        console.error('구글 로그인 정보 처리 중 서버 오류 발생:', error);
        res.status(500).json({ message: '서버 오류 발생', error: error.message });
    }
});


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

// --- 새로 추가: GET /users 엔드포인트 ---
// 이 엔드포인트는 모든 사용자 목록을 반환하며, 인증과 관리자 권한이 필요합니다.
app.get('/users', auth, authorizeAdmin, async (req, res) => {
    console.log('사용자 목록 조회 요청 (관리자만)');
    try {
        // 비밀번호 필드를 제외하고 모든 사용자 조회
        const users = await User.find().select('-password');
        res.status(200).json(users);
    } catch (error) {
        console.error('사용자 목록 조회 중 서버 오류 발생:', error);
        res.status(500).json({ message: '사용자 목록을 가져오는 데 실패했습니다.', error: error.message });
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