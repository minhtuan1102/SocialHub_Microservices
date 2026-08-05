import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import ChatWidget from "./ChatWidget";
import TopHeaderNav from "./TopHeaderNav";
import MaterialIcon from "./MaterialIcon";
import { useState, useEffect } from "react";
import api from "../services/api";

const Layout = () => {
    const { user, logout } = useAuth();
    const { unreadCount, toast, setToast } = useSocket();
    const navigate = useNavigate();
    const location = useLocation();

    const isMessagesPage = location.pathname === "/messages";
    const isReelsPage = location.pathname.startsWith("/reels");

    // ─── Joined Groups State for Left Sidebar ───
    const [joinedGroups, setJoinedGroups] = useState([]);

    useEffect(() => {
        const fetchJoinedGroups = async () => {
            try {
                const res = await api.get("/social-groups");
                if (res.data && res.data.success) {
                    setJoinedGroups(res.data.data || []);
                }
            } catch (err) {
                console.error("❌ Lỗi lấy nhóm đã tham gia:", err);
            }
        };
        if (user) {
            fetchJoinedGroups();
        }
    }, [user]);

    // ─── Dark Mode Toggle ───
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("socialhub-theme");
            if (saved) return saved === "dark";
            return window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        return false;
    });

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        localStorage.setItem("socialhub-theme", isDark ? "dark" : "light");
    }, [isDark]);

    // ─── Navigation Config ───
    const navItems = [
        { path: "/", icon: "public", label: "Bảng tin" },
        { path: "/groups", icon: "hub", label: "Nhóm" },
        { path: "/reels", icon: "motion_photos_on", label: "Reels" },
        { path: "/friends", icon: "people", label: "Bạn bè" },
    ];

    const isNavActive = (path) =>
        path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const handleToastClick = (t) => {
        setToast(null);
        if (t.referenceType === "post" || ["post_liked", "post_commented", "post_shared"].includes(t.type)) {
            if (t.referenceId) {
                navigate(`/post/${t.referenceId}`);
            } else {
                navigate("/");
            }
        } else if (t.type === "friend_request") {
            navigate("/friends");
        } else if (t.type === "friend_accepted" && t.fromUser?.id) {
            navigate(`/profile/${t.fromUser.id}`);
        } else if (t.type === "new_message") {
            navigate("/messages");
        } else {
            navigate("/notifications");
        }
    };

    return (
        <div className="min-h-screen bg-surface text-on-surface">
            {/* ═══ Toast Notification ═══ */}
            {toast && (
                <div
                    onClick={() => handleToastClick(toast)}
                    className="fixed top-5 right-5 z-[9999] bg-surface-container-low/80 dark:bg-surface-container-high/90 backdrop-blur-2xl border border-outline-variant/20 shadow-[0_20px_60px_rgba(142,148,242,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] rounded-2xl p-4 flex items-center space-x-3.5 cursor-pointer max-w-sm hover:shadow-2xl transition-shadow duration-300 animate-slide-in-right"
                >
                    <img
                        src={toast.fromUser?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        className="w-10 h-10 rounded-full border border-outline-variant/20 object-cover shrink-0"
                        alt="Sender Avatar"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-on-surface text-sm font-semibold truncate-2-lines">{toast.message}</p>
                        <p className="text-primary text-xs mt-0.5 font-medium">Bấm để xem chi tiết →</p>
                    </div>
                </div>
            )}

            {/* ═══ Mobile Top Bar ═══ */}
            <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-surface/80 dark:bg-surface-container/80 backdrop-blur-2xl border-b border-outline-variant/10 px-4 flex items-center justify-between z-50">
                <Link to="/" className="flex items-center space-x-2">
                    <img src="/logo.svg" alt="SocialHub Logo" className="w-8 h-8 object-contain" />
                    <span className="text-headline-md text-primary tracking-tight text-lg">SocialHub</span>
                </Link>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setIsDark(!isDark)}
                        className="p-2 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high/60 transition-all"
                        title="Chuyển giao diện"
                    >
                        <MaterialIcon name={isDark ? "light_mode" : "dark_mode"} size={20} />
                    </button>
                    <Link to={`/profile/${user?.id}`} className="flex items-center p-1 rounded-full hover:bg-surface-container-high/60 transition">
                        <img
                            src={user?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full border border-outline-variant/20 object-cover ring-2 ring-primary/10"
                        />
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="p-2 text-on-surface-variant hover:text-error rounded-xl hover:bg-error-container/30 transition active:scale-95 cursor-pointer"
                        title="Đăng xuất"
                    >
                        <MaterialIcon name="logout" size={20} />
                    </button>
                </div>
            </header>

            {/* ═══ Desktop Sidebar ═══ */}
            <aside className="hidden md:flex w-72 bg-surface-container-low/40 dark:bg-surface-container-low/60 backdrop-blur-2xl fixed h-screen z-30 flex-col pt-8 pb-6 shadow-[10px_0_40px_rgba(142,148,242,0.04)] dark:shadow-[10px_0_40px_rgba(0,0,0,0.2)]">
                <div className="flex-1 flex flex-col min-h-0 space-y-6">
                    {/* Brand Logo */}
                    <Link to="/" className="flex items-center space-x-3 group cursor-pointer select-none px-8 shrink-0">
                        <img
                            src="/logo.svg"
                            alt="SocialHub Logo"
                            className="h-8 w-auto object-contain group-hover:scale-105 transition duration-200"
                        />
                        <span className="text-headline-md text-primary tracking-tight group-hover:opacity-80 transition duration-200">
                            SocialHub
                        </span>
                    </Link>

                    {/* Navigation Links */}
                    <nav className="space-y-1.5 px-4 shrink-0">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center px-6 py-3.5 rounded-xl transition-all duration-300 group ${
                                    isNavActive(item.path)
                                        ? "bg-primary-container text-on-primary-container font-semibold"
                                        : "text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface"
                                }`}
                            >
                                <MaterialIcon
                                    name={item.icon}
                                    className={`mr-4 transition-opacity ${
                                        isNavActive(item.path) ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                                    }`}
                                />
                                <span className="text-body-md">{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    {/* Quick Access to Joined Groups (Truy cập nhanh Nhóm của bạn) */}
                    <div className="flex-1 px-4 pt-4 border-t border-outline-variant/10 overflow-hidden flex flex-col min-h-0">
                        <div className="flex items-center justify-between px-3 mb-2 shrink-0">
                            <span className="font-label-sm text-[11px] text-on-surface-variant/70 uppercase tracking-wider">Nhóm của bạn</span>
                            <Link to="/groups" className="text-[11px] text-primary hover:underline font-medium">Tất cả</Link>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-1 pr-1 no-scrollbar">
                            {joinedGroups.length > 0 ? (
                                joinedGroups.slice(0, 5).map((g) => {
                                    const targetId = g.id || g.groupId || g.group_id || g.group?.id;
                                    const targetName = g.name || g.group?.name || "Nhóm";
                                    const targetAvatar = g.avatar_url || g.avatarUrl || g.group?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${targetName}`;

                                    if (!targetId) return null;

                                    return (
                                        <Link
                                            key={targetId}
                                            to={`/groups/${targetId}`}
                                            className="flex items-center space-x-3 p-2 rounded-xl hover:bg-surface-container-high/60 transition group cursor-pointer"
                                        >
                                            <img
                                                src={targetAvatar}
                                                alt={targetName}
                                                className="w-8 h-8 rounded-lg object-cover border border-outline-variant/20 shrink-0"
                                            />
                                            <span className="text-xs text-on-surface-variant group-hover:text-on-surface font-medium truncate">
                                                {targetName}
                                            </span>
                                        </Link>
                                    );
                                })
                            ) : (
                                <p className="text-[11px] text-on-surface-variant/50 px-3 py-2 italic">Chưa tham gia nhóm nào.</p>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            {/* ═══ Desktop Header ═══ */}
            <header className="hidden md:flex fixed top-0 right-0 left-72 h-20 bg-surface/40 dark:bg-surface-container/40 backdrop-blur-3xl z-40 items-center justify-end gap-6 px-8 shadow-[0_1px_8px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_8px_rgba(0,0,0,0.15)]">
                {/* Search Bar */}
                <div className="flex items-center bg-surface-container-low/60 dark:bg-surface-container/60 rounded-full px-4 py-2 w-96 border border-outline-variant/10 mr-auto">
                    <MaterialIcon name="search" className="text-outline" size={20} />
                    <input
                        className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm px-3 w-full text-body-md text-on-surface placeholder:text-on-surface-variant/50"
                        placeholder="Tìm kiếm bài viết, bạn bè..."
                        type="text"
                    />
                </div>

                {/* Action Icons, Theme Toggle & Profile Quick Access */}
                <TopHeaderNav isDark={isDark} setIsDark={setIsDark} />
            </header>

            {/* ═══ Mobile Bottom Nav ═══ */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-surface/90 dark:bg-surface-container/90 backdrop-blur-2xl border-t border-outline-variant/10 z-40 flex items-center justify-around px-2 select-none">
                {[
                    { path: "/", icon: "public", label: "Feed" },
                    { path: "/friends", icon: "people", label: "Bạn bè" },
                    { path: "/reels", icon: "motion_photos_on", label: "Reels" },
                    { path: "/messages", icon: "chat_bubble", label: "Chat" },
                    { path: "/notifications", icon: "notifications", label: "TB" },
                ].map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition active:scale-95 ${
                            isNavActive(item.path) ? "text-primary font-bold" : "text-on-surface-variant hover:text-on-surface"
                        }`}
                    >
                        <div className="relative">
                            <MaterialIcon name={item.icon} size={22} filled={isNavActive(item.path)} />
                            {item.path === "/notifications" && unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1.5 bg-error text-on-error font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
                    </Link>
                ))}
            </nav>

            {/* ═══ Main Content Container (Offset by left 72 and right 64 on lg) ═══ */}
            <main className={`flex-1 ml-0 md:ml-72 lg:pr-64 ${isMessagesPage ? "pt-14 pb-16 md:pt-20 md:pb-8 p-2 md:p-4 min-h-screen" :
                    isReelsPage ? "fixed inset-0 top-14 bottom-16 md:static md:min-h-screen md:pt-20 md:pb-8 p-0 md:px-10" :
                        "pt-16 pb-20 md:pt-24 md:pb-8 p-3 sm:p-6 md:px-8 min-h-screen"
                } bg-gradient-to-br from-surface via-surface-container-lowest to-surface-container-low`}>
                <div className={isMessagesPage ? "w-full h-full" : isReelsPage ? "w-full h-full flex justify-center items-center" : "max-w-3xl mx-auto"}>
                    <Outlet />
                </div>
            </main>

            {/* ═══ Chat Widget ═══ */}
            <ChatWidget />
        </div>
    );
};

export default Layout;
