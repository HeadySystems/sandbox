const crypto = require('crypto');
const { AUTH_SECRET, TOKEN_TTL_MS } = require('./config');

function base64UrlEncode(value) {
    return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
    return Buffer.from(value, 'base64url').toString('utf8');
}

function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
}

function timingSafeEqualHex(leftHex, rightHex) {
    const left = Buffer.from(leftHex, 'hex');
    const right = Buffer.from(rightHex, 'hex');
    if (left.length !== right.length) {
        return false;
    }
    return crypto.timingSafeEqual(left, right);
}

class AuthService {
    constructor(store) {
        this.store = store;
    }

    register({ email, password, name }) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedName = String(name || '').trim() || normalizedEmail.split('@')[0];

        if (!normalizedEmail.includes('@') || String(password || '').length < 8) {
            throw new Error('INVALID_CREDENTIALS');
        }

        const users = this.store.getUsers();
        const existing = users.find((user) => user.email === normalizedEmail);
        if (existing) {
            throw new Error('EMAIL_EXISTS');
        }

        const userId = crypto.randomUUID();
        const passwordSalt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, passwordSalt);
        const now = new Date().toISOString();

        const newUser = {
            id: userId,
            email: normalizedEmail,
            name: normalizedName,
            passwordSalt,
            passwordHash,
            createdAt: now,
            updatedAt: now,
        };

        users.push(newUser);
        this.store.saveUsers(users);
        return this.createSession(newUser);
    }

    login({ email, password }) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const users = this.store.getUsers();
        const user = users.find((candidate) => candidate.email === normalizedEmail);

        if (!user) {
            throw new Error('INVALID_LOGIN');
        }

        const attemptedHash = hashPassword(password, user.passwordSalt);
        if (!timingSafeEqualHex(attemptedHash, user.passwordHash)) {
            throw new Error('INVALID_LOGIN');
        }

        return this.createSession(user);
    }

    createSession(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            name: user.name,
            exp: Date.now() + TOKEN_TTL_MS,
        };

        const encodedPayload = base64UrlEncode(JSON.stringify(payload));
        const signature = crypto.createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');

        return {
            token: `${encodedPayload}.${signature}`,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
            expiresAt: payload.exp,
        };
    }

    verifyToken(token) {
        const [encodedPayload, signature] = String(token || '').split('.');
        if (!encodedPayload || !signature) {
            throw new Error('TOKEN_REQUIRED');
        }

        const expected = crypto.createHmac('sha256', AUTH_SECRET).update(encodedPayload).digest('base64url');
        const validSignature = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        if (!validSignature) {
            throw new Error('TOKEN_INVALID');
        }

        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        if (!payload.exp || Date.now() > payload.exp) {
            throw new Error('TOKEN_EXPIRED');
        }

        return payload;
    }
}

module.exports = {
    AuthService,
};
