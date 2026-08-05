import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../services/api";
import { Lock, ArrowLeft, Loader, CheckCircle, AlertTriangle } from "lucide-react";

const ResetPassword = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        if (!token) {
            setError("Đường dẫn khôi phục mật khẩu thiếu mã Token xác thực. Vui lòng thử lại!");
        }
    }, [token]);

    useEffect(() => {
        if (isSuccess) {
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        navigate("/login");
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isSuccess, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token) {
            setError("Token xác thực không hợp lệ.");
            return;
        }

        if (password.length < 6) {
            setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Xác nhận mật khẩu mới không trùng khớp.");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const res = await api.post("/auth/reset-password", {
                token,
                newPassword: password
            });

            if (res.data && res.data.success) {
                setIsSuccess(true);
            } else {
                setError(res.data?.message || "Đã xảy ra lỗi, vui lòng thử lại.");
            }
        } catch (err) {
            console.error("❌ Lỗi reset mật khẩu:", err);
            setError(err.response?.data?.message || "Yêu cầu khôi phục thất bại hoặc liên kết đã hết hạn.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-slate-50 flex items-center justify-center p-4 overflow-hidden">
            {/* Vòng sáng phát quang */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[128px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/5 rounded-full blur-[128px] pointer-events-none"></div>

            {/* Hộp nội dung Glassmorphism */}
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 z-10">
                
                {isSuccess ? (
                    <div className="text-center space-y-4 py-4">
                        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
                        <h2 className="text-2xl font-bold text-slate-800">Đặt lại thành công!</h2>
                        <p className="text-slate-650 text-sm leading-relaxed">
                            Mật khẩu của bạn đã được thay đổi thành công.
                        </p>
                        <p className="text-slate-500 text-xs">
                            Hệ thống sẽ tự động chuyển về trang Đăng nhập sau <span className="font-bold text-blue-600">{countdown}</span> giây...
                        </p>
                        <div className="pt-4">
                            <Link
                                to="/login"
                                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl shadow-md transition duration-200 text-sm cursor-pointer"
                            >
                                Đăng nhập thủ công
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-6 sm:mb-8">
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Mật khẩu mới</h2>
                            <p className="text-slate-500 mt-2 text-xs sm:text-sm">
                                Hãy thiết lập mật khẩu mới và an toàn cho tài khoản SocialHub của bạn.
                            </p>
                        </div>

                        {error ? (
                            <div className="bg-red-50 border border-red-200 text-red-650 p-4 rounded-xl text-sm mb-6 flex items-start space-x-2.5 leading-relaxed">
                                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        ) : null}

                        {!token ? (
                            <div className="text-center py-4">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center space-x-1.5 px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer transition"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Trở về đăng nhập</span>
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* Mật khẩu mới Input */}
                                <div className="space-y-1.5">
                                    <label className="text-slate-700 text-xs sm:text-sm font-medium block">Mật khẩu mới</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                            <Lock className="w-5 h-5" />
                                        </span>
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Tối thiểu 6 ký tự"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-base sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition duration-200"
                                        />
                                    </div>
                                </div>

                                {/* Xác nhận mật khẩu mới Input */}
                                <div className="space-y-1.5">
                                    <label className="text-slate-700 text-xs sm:text-sm font-medium block">Xác nhận mật khẩu mới</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                            <Lock className="w-5 h-5" />
                                        </span>
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-base sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition duration-200"
                                        />
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-600/10 transition duration-200 active:scale-[0.99] disabled:opacity-50 cursor-pointer text-sm flex items-center justify-center space-x-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader className="w-4 h-4 animate-spin" />
                                            <span>Đang cập nhật...</span>
                                        </>
                                    ) : (
                                        <span>Đặt lại mật khẩu</span>
                                    )}
                                </button>
                            </form>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
