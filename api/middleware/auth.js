const jwt = require('jsonwebtoken');

// JWT Secret Key는 index.js와 동일하게 .env에서 가져옵니다.
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

const auth = (req, res, next) => {
    // 1. 요청 헤더에서 토큰 가져오기
    const authHeader = req.header('Authorization');

    // 토큰이 없거나 'Bearer '로 시작하지 않으면 401 Unauthorized
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No token, authorization denied or malformed token.');
        return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
    }

    // 'Bearer ' 부분을 제외한 실제 토큰 값 추출
    const token = authHeader.split(' ')[1];

    try {
        // 2. 토큰 검증
        const decoded = jwt.verify(token, JWT_SECRET); // JWT_SECRET을 사용하여 토큰 검증
        req.user = decoded; // 요청 객체에 디코딩된 사용자 정보 (userId, isAdmin 등) 저장
        console.log(`Token verified for user ID: ${req.user.userId}, isAdmin: ${req.user.isAdmin}`);
        next(); // 다음 미들웨어 또는 라우터 핸들러로 이동
    } catch (err) {
        console.error('Invalid token:', err.message);
        res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
    }
};

// 관리자 권한만 허용하는 미들웨어
const authorizeAdmin = (req, res, next) => {
    // req.user는 auth 미들웨어에서 추가됩니다.
    if (!req.user || !req.user.isAdmin) {
        console.log(`Unauthorized attempt by user ID: ${req.user?.userId} (isAdmin: ${req.user?.isAdmin})`);
        return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
    }
    next(); // 관리자 권한이 있으면 다음으로 이동
};

module.exports = { auth, authorizeAdmin };