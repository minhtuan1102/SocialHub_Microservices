import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import MaterialIcon from "../components/MaterialIcon";

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const { verifyEmail } = useAuth();
    const navigate = useNavigate();

    const [status, setStatus] = useState("loading"); // "loading" | "success" | "error"
    const [message, setMessage] = useState("");

    useEffect(() => {
        const triggerVerification = async () => {
            if (!token) {
                setStatus("error");
                setMessage("Mã liên kết xác thực không hợp lệ hoặc đã bị thiếu.");
                return;
            }

            setStatus("loading");
            const result = await verifyEmail(token);

            if (result.success) {
                setStatus("success");
                setMessage("Tài khoản của bạn đã được kích hoạt thành công!");
                // Chuyển hướng về trang chủ sau 3 giây
                setTimeout(() => {
                    navigate("/");
                }, 3000);
            } else {
                setStatus("error");
                setMessage(result.message || "Xác thực kích hoạt email thất bại.");
            }
        };

        triggerVerification();
    }, [token, verifyEmail, navigate]);

    return (
        <div className="relative min-h-screen bg-surface flex items-center justify-center p-4 overflow-hidden">
            {/* Vòng sáng background */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[128px] pointer-events-none"></div>

            {/* Hộp xác thực Glassmorphism */}
            <div className="w-full max-w-md bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-3xl border border-outline-variant/10 rounded-3xl p-6 sm:p-10 shadow-[0_20px_60px_rgba(142,148,242,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-10 animate-fade-in text-center">
                <img src="/logo.svg" alt="SocialHub Logo" className="w-16 h-16 mx-auto mb-6 object-contain" />

                {status === "loading" && (
                    <div className="space-y-4 py-6">
                        <div className="relative w-16 h-16 mx-auto">
                            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin"></div>
                        </div>
                        <h2 className="text-xl font-bold text-primary">Đang kích hoạt tài khoản</h2>
                        <p className="text-sm text-on-surface-variant">Vui lòng đợi trong giây lát khi chúng tôi xử lý yêu cầu...</p>
                    </div>
                )}

                {status === "success" && (
                    <div className="space-y-4 py-6 animate-scale-in">
                        <div className="w-16 h-16 bg-success-container/20 text-success rounded-full flex items-center justify-center mx-auto">
                            <MaterialIcon name="check_circle" size={40} className="text-emerald-500" />
                        </div>
                        <h2 className="text-xl font-bold text-emerald-600 dark:text-emerald-400">Thành công!</h2>
                        <p className="text-sm text-on-surface-variant">{message}</p>
                        <p className="text-xs text-on-surface-variant/60 pt-2 animate-pulse">Đang chuyển hướng về trang chủ...</p>
                    </div>
                )}

                {status === "error" && (
                    <div className="space-y-4 py-6 animate-scale-in">
                        <div className="w-16 h-16 bg-error-container/20 text-error rounded-full flex items-center justify-center mx-auto">
                            <MaterialIcon name="error" size={40} className="text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold text-red-600 dark:text-red-400">Xác thực thất bại</h2>
                        <p className="text-sm text-on-surface-variant">{message}</p>
                        <div className="pt-6 flex flex-col space-y-3">
                            <Link
                                to="/register"
                                className="w-full bg-primary hover:bg-primary/90 text-on-primary font-semibold py-3.5 rounded-2xl shadow-md transition duration-200 text-sm block"
                            >
                                Đăng ký lại
                            </Link>
                            <Link
                                to="/login"
                                className="w-full border border-outline/20 hover:bg-surface-container-low text-primary font-semibold py-3 rounded-2xl transition duration-200 text-sm block"
                            >
                                Quay lại Đăng nhập
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VerifyEmail;
