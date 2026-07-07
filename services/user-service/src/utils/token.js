import crypto from "crypto";
import jwt from "jsonwebtoken";

export const generateAccessToken = (userId) => {
    const token = jwt.sign(
        { id: userId, jti: crypto.randomUUID() },
        process.env.JWT_SECRET,
        { expiresIn: '15m' });

    return token;
}

export const generateRefreshToken = (userId) => {
    const token = jwt.sign(
        { id: userId, jti: crypto.randomUUID() },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' });

    return token;
}

// Calculate expiration time of refresh token
export const getRefreshTokenExpiry = (days = 7) => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    return expiryDate;
}