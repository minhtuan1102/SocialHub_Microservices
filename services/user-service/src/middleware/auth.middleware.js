import jwt from "jsonwebtoken";
import redis from "../config/redis.js";

export const protectRoute = async (req, res, next) => {
    try {
        let token;

        // Check token in Header Authorization
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Not authorized, token missing"
            });
        }

        // Decode token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check token in blacklist (logged out) in Redis
        if (decoded.jti) {
            const isBlacklisted = await redis.get(`blacklist:${decoded.jti}`);

            if (isBlacklisted) {
                return res.status(401).json({
                    success: false,
                    message: "Token has expired or logged out"
                });
            }
        }

        // Add decoded to request for controller to use
        req.user = {
            id: decoded.id,
            jti: decoded.jti,
            exp: decoded.exp,
            token
        }

        next();

    } catch (error) {
        console.error(" Error in middleware auth: ", error.message);

        return res.status(401).json({
            success: false,
            message: "Not authorized, invalid token"
        });
    }
}