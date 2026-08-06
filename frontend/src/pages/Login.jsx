import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import MaterialIcon from "../components/MaterialIcon";

const Login = () => {
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleCallback = async (response) => {
        setError("");
        setIsLoading(true);
        const result = await loginWithGoogle(response.credential);
        setIsLoading(false);

        if (result.success) {
            navigate("/");
        } else {
            setError(result.message);
        }
    };

    useEffect(() => {
        /* global google */
        if (window.google) {
            google.accounts.id.initialize({
                client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "1032514809228-example.apps.googleusercontent.com",
                callback: handleGoogleCallback
            });
            google.accounts.id.renderButton(
                document.getElementById("google-signin-btn"),
                { theme: "outline", size: "large", width: "100%" }
            );
        }
    }, [loginWithGoogle, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        const result = await login(email, password);
        setIsLoading(false);

        if (result.success) {
            navigate("/");
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="relative min-h-screen bg-surface flex items-center justify-center p-4 overflow-hidden">
            {/* Vòng sáng background */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[128px] pointer-events-none"></div>

            {/* Hộp đăng nhập Glassmorphism */}
            <div className="w-full max-w-md bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-3xl border border-outline-variant/10 rounded-3xl p-6 sm:p-10 shadow-[0_20px_60px_rgba(142,148,242,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-10 animate-fade-in">
                <div className="text-center mb-8">
                    <img src="/logo.svg" alt="SocialHub Logo" className="w-16 h-16 mx-auto mb-4 object-contain" />
                    <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">SocialHub</h2>
                    <p className="font-body-md text-sm text-on-surface-variant mt-2">Chào mừng bạn quay lại! Đăng nhập để kết nối.</p>
                </div>

                {error && (
                    <div className="bg-error-container/40 border border-error/30 text-error px-4 py-3 rounded-2xl text-xs mb-6 text-center font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="font-label-sm text-xs text-on-surface-variant block uppercase tracking-wider">Địa chỉ Email</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-on-surface-variant">
                                <MaterialIcon name="mail" size={20} />
                            </span>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                className="w-full bg-surface-container-low/60 border border-outline-variant/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="font-label-sm text-xs text-on-surface-variant block uppercase tracking-wider">Mật khẩu</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-on-surface-variant">
                                <MaterialIcon name="lock" size={20} />
                            </span>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-surface-container-low/60 border border-outline-variant/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition"
                            />
                        </div>
                        <div className="flex justify-end">
                            <Link to="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 hover:underline transition font-medium">
                                Quên mật khẩu?
                            </Link>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-primary/90 text-on-primary font-semibold py-3.5 rounded-2xl shadow-md transition duration-200 active:scale-[0.99] disabled:opacity-50 cursor-pointer text-sm flex items-center justify-center space-x-2"
                    >
                        {isLoading ? (
                            <MaterialIcon name="progress_activity" size={20} className="animate-spin" />
                        ) : (
                            <span>Đăng Nhập</span>
                        )}
                    </button>
                </form>

                {/* Dấu ngăn cách */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-slate-400">Hoặc tiếp tục với</span>
                    </div>
                </div>

                {/* Nút đăng nhập Google */}
                <div className="w-full flex justify-center select-none">
                    <div id="google-signin-btn" className="w-full"></div>
                </div>

                <div className="mt-8 text-center text-on-surface-variant text-sm">
                    Chưa có tài khoản?{" "}
                    <Link to="/register" className="text-primary hover:underline font-semibold transition">
                        Đăng ký ngay
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Login;
