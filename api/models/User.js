// models/User.js (새 파일 생성 권장)
const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // 일반 로그인용 ID
    password: { type: String, required: function() { return !this.googleId; } }, // 일반 로그인용 PW (구글 로그인 시 불필요)
    googleId: { type: String, unique: true, sparse: true }, // 구글 로그인 시 사용
    email: { type: String, unique: true, required: true },
    // 클라이언트 사용자 권한: QR 스캔 가능 여부
    canScanQr: { type: Boolean, default: false }, // true: 권한 있음, false: 권한 없음
    isAdmin: { type: Boolean, default: false }, // 관리자 여부 (관리자 사이트 로그인용)
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 비밀번호 해싱 미들웨어 (저장 전)
userSchema.pre('save', async function(next) {
    if (this.isModified('password') && this.password) {
        const bcrypt = require('bcryptjs');
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

UserSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;    // <-- _id를 id로 변환하는 핵심 부분
        delete ret._id;      // _id 필드는 제거
        delete ret.password; // 비밀번호 필드는 제거 (보안)
        return ret;
    }
});


// 비밀번호 검증 메서드
userSchema.methods.comparePassword = async function(candidatePassword) {
    const bcrypt = require('bcryptjs');
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
