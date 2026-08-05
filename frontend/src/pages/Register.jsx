import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import MaterialIcon from "../components/MaterialIcon";

const Register = () => {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        const result = await register(email, password, displayName);
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

            {/* Hộp đăng ký Glassmorphism */}
            <div className="w-full max-w-md bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-3xl border border-outline-variant/10 rounded-3xl p-6 sm:p-10 shadow-[0_20px_60px_rgba(142,148,242,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-10 animate-fade-in">
                <div className="text-center mb-8">
                    <img src="/logo.svg" alt="SocialHub Logo" className="w-16 h-16 mx-auto mb-4 object-contain" />
                    <h2 className="font-headline-lg text-headline-lg text-primary tracking-tight">Tạo tài khoản</h2>
                    <p className="font-body-md text-sm text-on-surface-variant mt-2">Gia nhập SocialHub để khám phá bạn bè mới.</p>
                </div>

                {error && (
                    <div className="bg-error-container/40 border border-error/30 text-error px-4 py-3 rounded-2xl text-xs mb-6 text-center font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="font-label-sm text-xs text-on-surface-variant block uppercase tracking-wider">Tên hiển thị (Họ tên)</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-on-surface-variant">
                                <MaterialIcon name="person" size={20} />
                            </span>
                            <input
                                type="text"
                                required
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Nguyễn Văn A"
                                className="w-full bg-surface-container-low/60 border border-outline-variant/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition"
                            />
                        </div>
                    </div>

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
                        <label className="font-label-sm text-xs text-on-surface-variant block uppercase tracking-wider">Mật khẩu (Tối thiểu 8 ký tự)</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-on-surface-variant">
                                <MaterialIcon name="lock" size={20} />
                            </span>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-surface-container-low/60 border border-outline-variant/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition"
                            />
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
                            <span>Đăng Ký Tài Khoản</span>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center text-on-surface-variant text-sm">
                    Đã có tài khoản rồi?{" "}
                    <Link to="/login" className="text-primary hover:underline font-semibold transition">
                        Đăng nhập ngay
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
