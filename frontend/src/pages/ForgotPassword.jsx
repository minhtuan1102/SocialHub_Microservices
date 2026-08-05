import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Mail, ArrowLeft, Loader, CheckCircle } from "lucide-react";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        setMessage("");

        try {
            const res = await api.post("/auth/forgot-password", { email: email.trim() });
            if (res.data && res.data.success) {
                setIsSent(true);
                setMessage(res.data.message || "Chúng tôi đã gửi link đặt lại mật khẩu đến email của bạn. Vui lòng kiểm tra hộp thư!");
            } else {
                setError(res.data?.message || "Đã xảy ra lỗi, vui lòng thử lại.");
            }
        } catch (err) {
            console.error("❌ Lỗi yêu cầu reset mật khẩu:", err);
            setError(err.response?.data?.message || "Không thể kết nối đến máy chủ. Vui lòng thử lại!");
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
                <div className="mb-6">
                    <Link to="/login" className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-blue-600 transition font-medium">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Quay lại Đăng nhập</span>
                    </Link>
                </div>

                {isSent ? (
                    <div className="text-center space-y-4 py-4">
                        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
                        <h2 className="text-2xl font-bold text-slate-800">Đã gửi yêu cầu!</h2>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            {message}
                        </p>
                        <p className="text-slate-500 text-xs italic">
                            (Nếu không nhận được email, vui lòng kiểm tra mục thư rác hoặc spam, hoặc kiểm tra logs của user-service ở Local)
                        </p>
                        <div className="pt-4">
                            <Link
                                to="/login"
                                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl shadow-md transition duration-200 text-sm cursor-pointer"
                            >
                                Đăng nhập ngay
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-6 sm:mb-8">
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Quên mật khẩu?</h2>
                            <p className="text-slate-500 mt-2 text-xs sm:text-sm">
                                Đừng lo lắng! Hãy nhập địa chỉ email đã đăng ký của bạn bên dưới, chúng tôi sẽ gửi liên kết khôi phục mật khẩu.
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6 text-center animate-shake font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Email Input */}
                            <div className="space-y-2">
                                <label className="text-slate-700 text-xs sm:text-sm font-medium block">Địa chỉ Email của bạn</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                        <Mail className="w-5 h-5" />
                                    </span>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="name@example.com"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-base sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition duration-200"
                                    />
                                </div>
                            </div>

                            {/* Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-600/10 transition duration-200 active:scale-[0.99] disabled:opacity-50 cursor-pointer text-sm flex items-center justify-center space-x-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader className="w-4 h-4 animate-spin" />
                                        <span>Đang gửi yêu cầu...</span>
                                    </>
                                ) : (
                                    <span>Gửi liên kết khôi phục</span>
                                )}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
