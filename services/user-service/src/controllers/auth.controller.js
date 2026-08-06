import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import redis from "../config/redis.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry } from "../utils/token.js";
import { sendResetPasswordEmail, sendVerificationLinkEmail } from "../utils/mail.js";

export const register = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Tất cả các trường là bắt buộc." });
        }

        // Kiểm tra email tồn tại trong Postgres
        const userAlreadyExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userAlreadyExists.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Tài khoản với Email này đã tồn tại." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Sinh token kích hoạt ngẫu nhiên (32 bytes hex)
        const token = crypto.randomBytes(32).toString("hex");

        // Lưu thông tin đăng ký tạm thời vào Redis với TTL 15 phút (900 giây)
        const pendingKey = `pending-register-token:${token}`;
        await redis.setex(pendingKey, 900, JSON.stringify({
            email,
            passwordHash: hashedPassword,
            displayName: name
        }));

        // Gửi email chứa link kích hoạt (chạy bất đồng bộ nền để tránh block HTTP response)
        sendVerificationLinkEmail(email, token);

        return res.status(200).json({
            success: true,
            message: "Một liên kết xác thực đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư để kích hoạt tài khoản."
        });

    } catch (error) {
        console.error("❌ Lỗi trong controller register:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi xử lý đăng ký." });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    try {

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const dbUser = result.rows[0];

        const isMatch = await bcrypt.compare(password, dbUser.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const accessToken = generateAccessToken(dbUser.id);
        const refreshToken = generateRefreshToken(dbUser.id);

        // Cập nhật last_login và updated_at trong DB
        const nowLogin = new Date();
        await pool.query(
            "UPDATE users SET last_login = $1, updated_at = $1 WHERE id = $2",
            [nowLogin, dbUser.id]
        );
        await redis.del(`user:${dbUser.id}`).catch(() => {});

        // Lưu Refresh Token mới vào PostgreSQL
        const expiry = getRefreshTokenExpiry(7);
        await pool.query(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
            [dbUser.id, refreshToken, expiry]
        );

        const user = {
            id: dbUser.id,
            email: dbUser.email,
            displayName: dbUser.display_name,
            bio: dbUser.bio,
            avatarUrl: dbUser.avatar_url,
            coverUrl: dbUser.cover_url,
            lastLogin: nowLogin
        }

        return res.status(200).json({
            success: true,
            user,
            tokens: { accessToken, refreshToken }
        });

    } catch (error) {
        console.error("Error in login controller: ", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export const logout = async (req, res) => {
    try {

        const { id: userId, jti, exp } = req.user;

        const now = Math.floor(Date.now() / 1000);
        const remainingSeconds = exp - now;

        if (remainingSeconds > 0) {
            await redis.setex(`blacklist:${jti}`, remainingSeconds, "true");
        }

        // Delete refresh token of user in DB
        await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });

    } catch (error) {
        console.error("Error in logout controller: ", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export const refresh = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            message: "Refresh token is required"
        });
    }

    try {

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        const tokenResult = await pool.query(
            "SELECT * FROM refresh_tokens WHERE token = $1",
            [refreshToken]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token"
            });
        }

        const dbToken = tokenResult.rows[0];

        if (dbToken.is_revoked || new Date(dbToken.expires_at) < new Date()) {
            await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [decoded.id]);
            return res.status(401).json({
                success: false,
                message: "Session expired or compromised"
            });
        }

        // Generate new tokens
        const newAccessToken = generateAccessToken(decoded.id);
        const newRefreshToken = generateRefreshToken(decoded.id);

        // Delete old token and insert new token
        await pool.query("DELETE FROM refresh_tokens WHERE token = $1", [refreshToken]);

        const expiry = getRefreshTokenExpiry(7);
        await pool.query(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
            [decoded.id, newRefreshToken, expiry]
        );

        return res.status(200).json({
            success: true,
            tokens: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            }
        });

    } catch (error) {
        console.error("Error in refresh token controller: ", error);
        return res.status(401).json({
            success: false,
            message: error.message
        });
    }
};

export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "Mật khẩu hiện tại và mật khẩu mới là bắt buộc." });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
        }

        // Tìm người dùng trong database
        const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
        }

        const dbUser = userRes.rows[0];

        // So sánh mật khẩu cũ
        const isMatch = await bcrypt.compare(currentPassword, dbUser.password_hash);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Mật khẩu hiện tại không chính xác." });
        }

        // Băm mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Cập nhật mật khẩu mới vào cơ sở dữ liệu
        await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hashedPassword, userId]);

        // Đăng xuất khỏi các thiết bị khác bằng cách xóa refresh tokens
        await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);

        return res.status(200).json({
            success: true,
            message: "Đổi mật khẩu thành công! Tất cả các phiên làm việc khác đã được đăng xuất."
        });

    } catch (error) {
        console.error("❌ Lỗi trong controller changePassword:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi đổi mật khẩu." });
    }
};

export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ success: false, message: "Email là bắt buộc." });
        }

        // Kiểm tra email tồn tại trong Postgres
        const userRes = await pool.query("SELECT id, email FROM users WHERE email = $1", [email]);
        
        // Trả về thông báo thành công chung (security best practice) nhưng thực tế chỉ gửi mail nếu tồn tại
        if (userRes.rows.length === 0) {
            // Log nội bộ để biết
            console.log(`ℹ️ [FORGOT PASSWORD] Email ${email} không tồn tại trong hệ thống.`);
            return res.status(200).json({
                success: true,
                message: "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi liên kết đặt lại mật khẩu."
            });
        }

        const user = userRes.rows[0];

        // Tạo Token reset mật khẩu
        const token = crypto.randomBytes(32).toString("hex");

        // Lưu vào Redis, thời gian hết hạn là 1 giờ (3600s)
        await redis.setex(`reset-token:${token}`, 3600, JSON.stringify({ userId: user.id, email: user.email }));

        // Gửi email (chạy bất đồng bộ nền để tránh block HTTP response)
        sendResetPasswordEmail(user.email, token);

        return res.status(200).json({
            success: true,
            message: "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi liên kết đặt lại mật khẩu."
        });

    } catch (error) {
        console.error("❌ Lỗi trong controller forgotPassword:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi xử lý yêu cầu quên mật khẩu." });
    }
};

export const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        if (!token || !newPassword) {
            return res.status(400).json({ success: false, message: "Token và mật khẩu mới là bắt buộc." });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
        }

        // Lấy thông tin lưu trong Redis
        const dataStr = await redis.get(`reset-token:${token}`);
        if (!dataStr) {
            return res.status(400).json({
                success: false,
                message: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn."
            });
        }

        const { userId } = JSON.parse(dataStr);

        // Băm mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Cập nhật vào Postgres
        await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hashedPassword, userId]);

        // Xóa refresh tokens cũ
        await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);

        // Xóa token reset khỏi Redis
        await redis.del(`reset-token:${token}`);

        return res.status(200).json({
            success: true,
            message: "Đặt lại mật khẩu thành công! Bạn có thể dùng mật khẩu mới để đăng nhập."
        });

    } catch (error) {
        console.error("❌ Lỗi trong controller resetPassword:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi đặt lại mật khẩu." });
    }
};

export const googleLogin = async (req, res) => {
    const { idToken } = req.body;

    try {
        if (!idToken) {
            return res.status(400).json({ success: false, message: "Google ID Token là bắt buộc." });
        }

        // Xác thực ID Token qua Google client
        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            payload = ticket.getPayload();
        } catch (verifyErr) {
            console.error("❌ Lỗi xác thực Google Token:", verifyErr.message);
            return res.status(400).json({ success: false, message: "Google ID Token không hợp lệ hoặc đã hết hạn." });
        }

        const { email, name, picture } = payload;
        if (!email) {
            return res.status(400).json({ success: false, message: "Không thể lấy thông tin email từ tài khoản Google." });
        }

        // Tìm người dùng trong database Postgres
        let userRes = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        let dbUser;

        if (userRes.rows.length === 0) {
            // Đăng ký tài khoản mới tự động
            // Do đăng nhập bằng Google, ta tạo một password_hash placeholder ngẫu nhiên
            const randomPassword = crypto.randomBytes(16).toString("hex");
            const passwordHash = await bcrypt.hash(randomPassword, 10);
            const displayName = name || email.split("@")[0];
            const avatarUrl = picture || "";

            const insertRes = await pool.query(
                "INSERT INTO users (email, password_hash, display_name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *",
                [email, passwordHash, displayName, avatarUrl]
            );
            dbUser = insertRes.rows[0];
            console.log(`🌱 Đăng ký tài khoản Google mới thành công: ${email}`);
        } else {
            dbUser = userRes.rows[0];
            // Cập nhật lại avatar từ Google nếu trong DB chưa có
            if (!dbUser.avatar_url && picture) {
                await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [picture, dbUser.id]);
                dbUser.avatar_url = picture;
            }
            console.log(`🔑 Đăng nhập bằng Google thành công: ${email}`);
        }

        // Tạo JWT
        const accessToken = generateAccessToken(dbUser.id);
        const refreshToken = generateRefreshToken(dbUser.id);

        // Cập nhật last_login trong DB
        const nowLogin = new Date();
        await pool.query(
            "UPDATE users SET last_login = $1, updated_at = $1 WHERE id = $2",
            [nowLogin, dbUser.id]
        );
        await redis.del(`user:${dbUser.id}`).catch(() => {});

        // Lưu Refresh Token mới
        const expiry = getRefreshTokenExpiry(7);
        await pool.query(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
            [dbUser.id, refreshToken, expiry]
        );

        const user = {
            id: dbUser.id,
            email: dbUser.email,
            displayName: dbUser.display_name,
            avatarUrl: dbUser.avatar_url,
            bio: dbUser.bio,
            coverUrl: dbUser.cover_url
        };

        return res.status(200).json({
            success: true,
            user,
            tokens: {
                accessToken,
                refreshToken
            }
        });

    } catch (error) {
        console.error("❌ Lỗi trong controller googleLogin:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi xử lý đăng nhập Google." });
    }
};

export const verifyEmail = async (req, res) => {
    const { token } = req.body;

    try {
        if (!token) {
            return res.status(400).json({ success: false, message: "Token xác thực là bắt buộc." });
        }

        const pendingKey = `pending-register-token:${token}`;
        const dataStr = await redis.get(pendingKey);
        if (!dataStr) {
            return res.status(400).json({
                success: false,
                message: "Liên kết kích hoạt đã hết hạn hoặc không hợp lệ. Vui lòng đăng ký lại."
            });
        }

        const { email, passwordHash, displayName } = JSON.parse(dataStr);

        // Kiểm tra email trùng lặp một lần nữa trong Postgres (tránh race conditions)
        const userAlreadyExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userAlreadyExists.rows.length > 0) {
            await redis.del(pendingKey);
            return res.status(400).json({ success: false, message: "Tài khoản với Email này đã được đăng ký và kích hoạt trước đó." });
        }

        // Tạo tài khoản chính thức vào Postgres
        const insertQuery = `
            INSERT INTO users (email, password_hash, display_name)
            VALUES ($1, $2, $3)
            RETURNING id, email, display_name as "displayName", bio, avatar_url as "avatarUrl", cover_url as "coverUrl"
        `;
        const insertRes = await pool.query(insertQuery, [email, passwordHash, displayName]);
        const dbUser = insertRes.rows[0];

        // Xóa thông tin tạm trong Redis
        await redis.del(pendingKey);

        // Tạo JWT Access/Refresh tokens
        const accessToken = generateAccessToken(dbUser.id);
        const refreshToken = generateRefreshToken(dbUser.id);

        // Cập nhật last_login
        const nowLogin = new Date();
        await pool.query(
            "UPDATE users SET last_login = $1, updated_at = $1 WHERE id = $2",
            [nowLogin, dbUser.id]
        );

        // Lưu Refresh Token vào DB
        const expiry = getRefreshTokenExpiry(7);
        await pool.query(
            "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
            [dbUser.id, refreshToken, expiry]
        );

        const user = {
            id: dbUser.id,
            email: dbUser.email,
            displayName: dbUser.displayName,
            avatarUrl: dbUser.avatarUrl,
            bio: dbUser.bio,
            coverUrl: dbUser.coverUrl
        };

        return res.status(201).json({
            success: true,
            user,
            tokens: {
                accessToken,
                refreshToken
            }
        });

    } catch (error) {
        console.error("❌ Lỗi trong controller verifyEmail:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi xác thực email kích hoạt." });
    }
};;