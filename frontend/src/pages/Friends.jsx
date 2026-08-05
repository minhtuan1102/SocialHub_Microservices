import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import MaterialIcon from "../components/MaterialIcon";
import { useConfirm } from "../context/ConfirmContext";

const Friends = () => {
    const { user: currentUser } = useAuth();
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState("requests");
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searchStatuses, setSearchStatuses] = useState({});
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/friends/requests?type=received");
            if (res.data && res.data.success) {
                setRequests(res.data.data || []);
            }
        } catch (err) {
            console.error("Lỗi lấy lời mời kết bạn:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchFriends = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/friends");
            if (res.data && res.data.success) {
                setFriends(res.data.data || []);
            }
        } catch (err) {
            console.error("Lỗi lấy danh sách bạn bè:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSuggestions = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/friends/suggestions?limit=10");
            if (res.data && res.data.success) {
                setSuggestions(res.data.suggestions || []);
            }
        } catch (err) {
            console.error("Lỗi lấy gợi ý bạn bè:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
        fetchFriends();
        fetchSuggestions();
    }, []);

    useEffect(() => {
        setSearchResults([]);
        setSearchQuery("");
    }, [activeTab]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const res = await api.get(`/users/search?q=${searchQuery}`);
            if (res.data && res.data.success) {
                const users = res.data.data.filter(u => u.id !== currentUser.id);
                setSearchResults(users);

                const statusPromises = users.map(async (u) => {
                    const statusRes = await api.get(`/friends/check/${u.id}`);
                    return { userId: u.id, data: statusRes.data };
                });
                const statuses = await Promise.all(statusPromises);
                const statusMap = {};
                statuses.forEach(s => {
                    statusMap[s.userId] = s.data;
                });
                setSearchStatuses(statusMap);
            }
        } catch (err) {
            console.error("Lỗi tìm kiếm bạn bè:", err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSendRequest = async (toUserId) => {
        try {
            const res = await api.post("/friends/request", { toUserId });
            if (res.data && res.data.success) {
                setSearchStatuses(prev => ({
                    ...prev,
                    [toUserId]: { status: "pending_sent", requestId: res.data.data.id }
                }));
                fetchSuggestions();
            }
        } catch (err) {}
    };

    const handleAccept = async (requestId, fromUserId) => {
        try {
            const res = await api.put(`/friends/requests/${requestId}/accept`);
            if (res.data && res.data.success) {
                setRequests(prev => prev.filter(r => r.id !== requestId));
                fetchFriends();
            }
        } catch (err) {
            console.error("Lỗi chấp nhận lời mời:", err);
        }
    };

    const handleReject = async (requestId) => {
        try {
            const res = await api.put(`/friends/requests/${requestId}/reject`);
            if (res.data && res.data.success) {
                setRequests(prev => prev.filter(r => r.id !== requestId));
            }
        } catch (err) {
            console.error("Lỗi từ chối lời mời:", err);
        }
    };

    const handleUnfriend = async (friendId) => {
        const isConfirmed = await confirm({
            title: "Hủy kết bạn",
            message: "Bạn có chắc chắn muốn hủy kết bạn với người này?",
            confirmText: "Hủy kết bạn",
            type: "danger"
        });
        if (!isConfirmed) return;
        try {
            const res = await api.delete(`/friends/${friendId}`);
            if (res.data && res.data.success) {
                setFriends(prev => prev.filter(f => f.id !== friendId));
            }
        } catch (err) {
            console.error("Lỗi hủy kết bạn:", err);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="mb-6">
                <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight flex items-center gap-3">
                    <MaterialIcon name="group" size={36} />
                    <span>Bạn bè</span>
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant mt-2">Kết nối và quản lý danh sách bạn bè của bạn.</p>
            </div>

            {/* Ô TÌM KIẾM */}
            <form onSubmit={handleSearch} className="relative max-w-xl">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm mọi người theo tên hoặc email..."
                    className="w-full bg-surface-container-low/60 dark:bg-surface-container/60 border border-outline-variant/10 focus:border-primary rounded-full pl-12 pr-28 py-3.5 text-on-surface placeholder:text-on-surface-variant/50 outline-none transition"
                />
                <MaterialIcon name="search" className="absolute left-4 top-4 text-on-surface-variant" size={20} />
                <button
                    type="submit"
                    className="absolute right-2 top-2 bg-primary hover:bg-primary/90 text-on-primary font-label-sm text-xs font-semibold px-4 py-2 rounded-full cursor-pointer transition"
                >
                    Tìm kiếm
                </button>
            </form>

            {/* KẾT QUẢ TÌM KIẾM */}
            {searchResults.length > 0 && (
                <div className="bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-2xl p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4">
                    <h3 className="font-headline-md text-sm text-on-surface">Kết quả tìm kiếm ({searchResults.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {searchResults.map(u => {
                            const rel = searchStatuses[u.id] || { status: "none" };
                            return (
                                <div key={u.id} className="bg-surface-container-lowest/60 dark:bg-surface-container-low/60 border border-outline-variant/10 rounded-2xl p-4 flex items-center justify-between">
                                    <Link to={`/profile/${u.id}`} className="flex items-center space-x-3 group cursor-pointer min-w-0">
                                        <img src={u.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"} className="w-12 h-12 rounded-full border border-outline-variant/20 group-hover:opacity-80 transition object-cover shrink-0" alt="Avatar" />
                                        <div className="min-w-0">
                                            <p className="font-bold text-on-surface text-sm group-hover:text-primary transition truncate">{u.displayName}</p>
                                            <p className="text-xs text-on-surface-variant truncate">{u.email}</p>
                                        </div>
                                    </Link>
                                    <div className="shrink-0 ml-2">
                                        {rel.status === "none" && (
                                            <button
                                                onClick={() => handleSendRequest(u.id)}
                                                className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-xl text-xs font-semibold cursor-pointer transition"
                                            >
                                                Thêm bạn
                                            </button>
                                        )}
                                        {rel.status === "pending_sent" && (
                                            <span className="text-xs text-on-surface-variant italic">Đã gửi lời mời</span>
                                        )}
                                        {rel.status === "friends" && (
                                            <span className="text-xs text-secondary font-semibold flex items-center gap-1">
                                                <MaterialIcon name="check" size={16} /> Bạn bè
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {isSearching && (
                <div className="flex justify-center py-4"><MaterialIcon name="progress_activity" className="animate-spin text-primary" size={24} /></div>
            )}

            {/* TABS ĐIỀU HƯỚNG */}
            <div className="flex border-b border-outline-variant/10 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab("requests")}
                    className={`flex items-center space-x-2 px-6 py-3 font-semibold text-xs sm:text-sm border-b-2 transition cursor-pointer whitespace-nowrap ${
                        activeTab === "requests" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
                    }`}
                >
                    <span>Lời mời ({requests.length})</span>
                </button>
                <button
                    onClick={() => setActiveTab("list")}
                    className={`flex items-center space-x-2 px-6 py-3 font-semibold text-xs sm:text-sm border-b-2 transition cursor-pointer whitespace-nowrap ${
                        activeTab === "list" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
                    }`}
                >
                    <span>Danh sách bạn bè ({friends.length})</span>
                </button>
                <button
                    onClick={() => setActiveTab("suggestions")}
                    className={`flex items-center space-x-2 px-6 py-3 font-semibold text-xs sm:text-sm border-b-2 transition cursor-pointer whitespace-nowrap ${
                        activeTab === "suggestions" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
                    }`}
                >
                    <MaterialIcon name="auto_awesome" className="text-secondary" size={18} />
                    <span>Gợi ý bạn bè</span>
                </button>
            </div>

            {/* NỘI DUNG TỪNG TAB */}
            {isLoading ? (
                <div className="flex justify-center py-12"><MaterialIcon name="progress_activity" size={32} className="text-primary animate-spin" /></div>
            ) : (
                <div className="min-h-[200px]">
                    {/* TAB 1: LỜI MỜI */}
                    {activeTab === "requests" && (
                        requests.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 animate-fade-in">
                                {requests.map(r => (
                                    <div key={r.id} className="bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-2xl border border-outline-variant/10 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                                        <Link to={`/profile/${r.fromUserId}`} className="flex items-center space-x-3 group cursor-pointer min-w-0">
                                            <img src={r.user?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"} className="w-12 h-12 rounded-full border border-outline-variant/20 group-hover:opacity-80 transition object-cover shrink-0" alt="Avatar" />
                                            <div className="min-w-0">
                                                <p className="font-bold text-on-surface text-sm group-hover:text-primary transition truncate">{r.user?.displayName}</p>
                                                <p className="text-[11px] text-on-surface-variant">Gửi: {new Date(r.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </Link>
                                        <div className="flex space-x-2 shrink-0">
                                            <button
                                                onClick={() => handleAccept(r.id, r.fromUserId)}
                                                className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-xl text-xs font-semibold cursor-pointer transition shadow-md"
                                            >
                                                Đồng ý
                                            </button>
                                            <button
                                                onClick={() => handleReject(r.id)}
                                                className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant rounded-xl text-xs font-semibold cursor-pointer transition border border-outline-variant/10"
                                            >
                                                Từ chối
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-on-surface-variant/60 text-sm">Hộp thư trống. Không có lời mời kết bạn nào!</div>
                        )
                    )}

                    {/* TAB 2: DANH SÁCH BẠN BÈ */}
                    {activeTab === "list" && (
                        friends.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-fade-in">
                                {friends.map(f => (
                                    <div key={f.id} className="bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-2xl border border-outline-variant/10 rounded-2xl p-5 flex flex-col items-center text-center space-y-3 shadow-sm">
                                        <Link to={`/profile/${f.id}`} className="group block cursor-pointer">
                                            <img src={f.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"} className="w-16 h-16 rounded-full border-2 border-primary/20 group-hover:opacity-80 transition object-cover" alt="Avatar" />
                                        </Link>
                                        <div>
                                            <Link to={`/profile/${f.id}`} className="font-bold text-on-surface text-sm hover:text-primary transition block truncate max-w-[150px]">{f.displayName}</Link>
                                            <p className="text-[11px] text-on-surface-variant truncate max-w-[150px]">{f.email}</p>
                                        </div>
                                        <button
                                            onClick={() => handleUnfriend(f.id)}
                                            className="w-full flex items-center justify-center space-x-1.5 py-2 bg-error-container/30 hover:bg-error-container/60 text-error rounded-xl text-xs cursor-pointer transition border border-outline-variant/10"
                                        >
                                            <MaterialIcon name="person_remove" size={16} />
                                            <span>Hủy kết bạn</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-on-surface-variant/60 text-sm">Bạn chưa kết bạn với ai. Hãy dùng ô tìm kiếm để tìm bạn bè mới nhé!</div>
                        )
                    )}

                    {/* TAB 3: GỢI Ý BẠN BÈ */}
                    {activeTab === "suggestions" && (
                        suggestions.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                {suggestions.map(s => (
                                    <div key={s.id} className="bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-2xl border border-outline-variant/10 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                                        <Link to={`/profile/${s.id}`} className="flex items-center space-x-3 group cursor-pointer min-w-0">
                                            <img src={s.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"} className="w-12 h-12 rounded-full border border-outline-variant/20 group-hover:opacity-80 transition object-cover shrink-0" alt="Avatar" />
                                            <div className="min-w-0">
                                                <p className="font-bold text-on-surface group-hover:text-primary transition truncate">{s.displayName}</p>
                                                <p className="text-xs text-primary font-medium">{s.mutualFriendCount} bạn chung</p>
                                            </div>
                                        </Link>
                                        <button
                                            onClick={() => handleSendRequest(s.id)}
                                            className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-semibold cursor-pointer transition"
                                        >
                                            Thêm bạn
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-on-surface-variant/60 text-sm">Chưa tìm thấy gợi ý bạn bè phù hợp dựa trên bạn chung.</div>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default Friends;
