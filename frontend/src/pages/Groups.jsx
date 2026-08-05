import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import MaterialIcon from "../components/MaterialIcon";

const Groups = () => {
    const [groups, setGroups] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Form states for creating a group
    const [groupName, setGroupName] = useState("");
    const [groupDesc, setGroupDesc] = useState("");
    const [groupPrivacy, setGroupPrivacy] = useState("public");
    const [postApproval, setPostApproval] = useState(true);
    const [createLoading, setCreateLoading] = useState(false);

    useEffect(() => {
        fetchJoinedGroups();
    }, []);

    const fetchJoinedGroups = async () => {
        setLoading(true);
        try {
            const res = await api.get("/social-groups");
            if (res.data && res.data.success) {
                setGroups(res.data.data || []);
            }
        } catch (err) {
            console.error("❌ Lỗi lấy danh sách nhóm:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setIsSearching(false);
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const res = await api.get(`/social-groups/search?q=${encodeURIComponent(searchQuery)}`);
            if (res.data && res.data.success) {
                setSearchResults(res.data.data || []);
            }
        } catch (err) {
            console.error("❌ Lỗi tìm kiếm nhóm:", err);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!groupName.trim()) return;

        setCreateLoading(true);
        try {
            const res = await api.post("/social-groups", {
                name: groupName,
                description: groupDesc,
                privacy: groupPrivacy,
                postApprovalRequired: postApproval
            });

            if (res.data && res.data.success) {
                setShowCreateModal(false);
                setGroupName("");
                setGroupDesc("");
                setGroupPrivacy("public");
                setPostApproval(true);
                fetchJoinedGroups();
            }
        } catch (err) {
        } finally {
            setCreateLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header Area (groupscreen.html: Pulse Title + Subtitle) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-2xl p-8 rounded-3xl border border-outline-variant/10 shadow-[0_10px_40px_rgba(79,85,174,0.05)]">
                <div>
                    <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight flex items-center gap-3">
                        <MaterialIcon name="hub" size={36} />
                        <span>Nhóm</span>
                    </h1>
                    <p className="font-body-lg text-body-lg text-on-surface-variant mt-2">Khám phá và tham gia các cộng đồng học tập, chia sẻ tri thức.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center justify-center space-x-2 bg-primary hover:bg-primary/90 text-on-primary font-label-sm text-label-sm px-6 py-3 rounded-2xl shadow-md cursor-pointer transition active:scale-95 self-start sm:self-auto"
                >
                    <MaterialIcon name="add" size={20} />
                    <span>Tạo nhóm mới</span>
                </button>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative max-w-xl">
                <input
                    type="text"
                    placeholder="Tìm kiếm nhóm học tập, thảo luận..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (!e.target.value.trim()) {
                            setIsSearching(false);
                            setSearchResults([]);
                        }
                    }}
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

            {/* Search Results Area */}
            {isSearching && (
                <div className="bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-2xl p-8 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4">
                    <h2 className="font-headline-md text-lg text-on-surface">Kết quả tìm kiếm ({searchResults.length})</h2>
                    {searchResults.length === 0 ? (
                        <p className="text-on-surface-variant text-sm">Không tìm thấy nhóm nào phù hợp với từ khóa.</p>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {searchResults.map((g) => (
                                <Link
                                    key={g.id}
                                    to={`/groups/${g.id}`}
                                    className="flex items-center justify-between p-5 bg-surface-container-lowest/60 dark:bg-surface-container-low/60 hover:bg-primary-container/10 border border-outline-variant/10 rounded-2xl transition group"
                                >
                                    <div className="flex items-center space-x-4 min-w-0">
                                        <img
                                            src={g.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${g.name}`}
                                            alt={g.name}
                                            className="w-12 h-12 rounded-xl object-cover border border-outline-variant/20"
                                        />
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-on-surface group-hover:text-primary transition truncate">{g.name}</h4>
                                            <p className="text-xs text-on-surface-variant mt-0.5 flex items-center space-x-1.5">
                                                <MaterialIcon name={g.privacy === "public" ? "public" : "lock"} size={14} />
                                                <span>{g.privacy === "public" ? "Công khai" : "Riêng tư"}</span>
                                                <span>•</span>
                                                <span>{g._count?.members || 0} thành viên</span>
                                            </p>
                                        </div>
                                    </div>
                                    <MaterialIcon name="arrow_forward" className="text-on-surface-variant group-hover:text-primary group-hover:translate-x-1 transition shrink-0 ml-2" size={20} />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Joined Groups List (Bento Grid cards based on groupscreen.html) */}
            <div className="space-y-6">
                <h3 className="font-headline-md text-xl text-on-surface">Nhóm đã tham gia</h3>
                {loading ? (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse bg-surface-container-low/60 border border-outline-variant/10 rounded-3xl h-48" />
                        ))}
                    </div>
                ) : groups.length === 0 ? (
                    <div className="bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-2xl p-12 text-center border border-outline-variant/10 rounded-3xl">
                        <MaterialIcon name="hub" size={48} className="text-on-surface-variant/40 mb-3 mx-auto" />
                        <p className="text-on-surface-variant text-body-md">Bạn chưa tham gia bất kỳ nhóm nào.</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-4 inline-flex items-center space-x-2 text-primary hover:underline font-semibold text-sm cursor-pointer"
                        >
                            <MaterialIcon name="add" size={18} />
                            <span>Tạo nhóm của riêng bạn ngay</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {groups.map((g, idx) => (
                            <Link
                                key={g.id}
                                to={`/groups/${g.id}`}
                                className={`flex flex-col justify-between p-6 bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-2xl hover:bg-surface-container-high/80 border border-outline-variant/10 rounded-3xl transition-all duration-300 group shadow-sm hover:-translate-y-1 ${
                                    idx === 0 ? "md:col-span-2 bg-gradient-to-br from-primary-container/20 to-surface-container-low/60" : ""
                                }`}
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3.5 min-w-0">
                                            <img
                                                src={g.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${g.name}`}
                                                alt={g.name}
                                                className="w-14 h-14 rounded-2xl object-cover border border-outline-variant/20 shrink-0"
                                            />
                                            <div className="min-w-0">
                                                <h4 className="font-headline-md text-lg text-on-surface group-hover:text-primary transition truncate">{g.name}</h4>
                                                <span className="px-3 py-1 rounded-full bg-secondary-container/30 text-secondary text-[10px] font-label-sm uppercase tracking-wider inline-block mt-1">
                                                    {g.privacy === "public" ? "Công khai" : "Riêng tư"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="font-body-md text-sm text-on-surface-variant line-clamp-2">
                                        {g.description || "Không có mô tả cho nhóm này."}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between pt-4 mt-4 border-t border-outline-variant/10 text-xs text-on-surface-variant">
                                    <span className="flex items-center space-x-1.5 font-label-sm">
                                        <MaterialIcon name="group" size={16} className="text-primary" />
                                        <span>{g._count?.members || 0} thành viên</span>
                                    </span>
                                    <MaterialIcon name="arrow_forward" className="text-on-surface-variant group-hover:text-primary group-hover:translate-x-1 transition" size={20} />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Group Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-surface-container-lowest dark:bg-surface-container-high rounded-3xl w-full max-w-lg border border-outline-variant/10 shadow-2xl p-6 md:p-8 animate-slide-up space-y-6">
                        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/10">
                            <h2 className="font-headline-md text-xl text-on-surface">Tạo nhóm thảo luận mới</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-on-surface-variant hover:text-on-surface transition cursor-pointer p-1 rounded-full hover:bg-surface-container-high"
                            >
                                <MaterialIcon name="close" size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateGroup} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-on-surface text-sm font-semibold">Tên nhóm <span className="text-error">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ví dụ: Lập trình Node.js & React"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="w-full bg-surface-container-low/60 border border-outline-variant/10 focus:border-primary rounded-xl px-4 py-2.5 text-on-surface outline-none transition text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-on-surface text-sm font-semibold">Mô tả nhóm</label>
                                <textarea
                                    placeholder="Giới thiệu mục tiêu và quy tắc hoạt động của nhóm..."
                                    rows="3"
                                    value={groupDesc}
                                    onChange={(e) => setGroupDesc(e.target.value)}
                                    className="w-full bg-surface-container-low/60 border border-outline-variant/10 focus:border-primary rounded-xl px-4 py-2.5 text-on-surface outline-none transition text-sm resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-on-surface text-sm font-semibold">Chế độ riêng tư</label>
                                    <select
                                        value={groupPrivacy}
                                        onChange={(e) => setGroupPrivacy(e.target.value)}
                                        className="w-full bg-surface-container-low/60 border border-outline-variant/10 focus:border-primary rounded-xl px-3 py-2.5 text-on-surface outline-none transition text-sm cursor-pointer"
                                    >
                                        <option value="public">Công khai (Public)</option>
                                        <option value="private">Riêng tư (Private)</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-on-surface text-sm font-semibold">Quy tắc đăng bài</label>
                                    <select
                                        value={postApproval ? "true" : "false"}
                                        onChange={(e) => setPostApproval(e.target.value === "true")}
                                        className="w-full bg-surface-container-low/60 border border-outline-variant/10 focus:border-primary rounded-xl px-3 py-2.5 text-on-surface outline-none transition text-sm cursor-pointer"
                                    >
                                        <option value="true">Admin duyệt bài đăng</option>
                                        <option value="false">Đăng trực tiếp tự do</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3 pt-4 border-t border-outline-variant/10 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-5 py-2.5 border border-outline-variant/10 text-on-surface-variant hover:bg-surface-container-high font-medium rounded-xl text-sm transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={createLoading}
                                    className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded-xl text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                                >
                                    {createLoading ? "Đang tạo..." : "Tạo nhóm"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Groups;
