import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import MaterialIcon from "../components/MaterialIcon";
import api from "../services/api";
import { getMediaFileUrl } from "../services/mediaUrl";
import PostCard from "../components/PostCard";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";

const GroupDetail = () => {
    const { user } = useAuth();
    const confirm = useConfirm();
    const { id } = useParams();
    const navigate = useNavigate();
    const [group, setGroup] = useState(null);
    const [posts, setPosts] = useState([]);
    const [pendingPosts, setPendingPosts] = useState([]);
    const [pendingMembers, setPendingMembers] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("posts"); // "posts" | "members" | "moderation"

    const [postStatusFilter, setPostStatusFilter] = useState("approved"); // "approved" | "pending" | "rejected"
    const [filterAuthorId, setFilterAuthorId] = useState(null);
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    const [updatingSettings, setUpdatingSettings] = useState(false);
    const headerMenuRef = useRef(null);

    // Members tab search & filter
    const [memberSearch, setMemberSearch] = useState("");
    const [memberRoleFilter, setMemberRoleFilter] = useState("all");
    const [updatingRoleId, setUpdatingRoleId] = useState(null);

    // Create post in group state
    const [newPostContent, setNewPostContent] = useState("");
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [mediaIds, setMediaIds] = useState([]);
    const [mediaPreviews, setMediaPreviews] = useState([]);

    useEffect(() => {
        fetchGroupDetails();
    }, [id]);

    // Đóng header menu khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
                setShowHeaderMenu(false);
            }
        };
        if (showHeaderMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showHeaderMenu]);

    const fetchGroupDetails = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/social-groups/${id}`);
            if (res.data && res.data.success) {
                const groupData = res.data.data;
                setGroup(groupData);

                // Fetch posts if public or if user is approved member
                if (groupData.privacy === "public" || groupData.currentUserMemberStatus === "approved") {
                    fetchGroupPosts("approved", null);
                    fetchGroupMembers();

                    // If user is admin/moderator, fetch moderation details
                    if (groupData.currentUserRole === "admin" || groupData.currentUserRole === "moderator") {
                        fetchPendingPosts();
                        fetchPendingMembers();
                    }
                }
            }
        } catch (err) {
            navigate("/groups");
        } finally {
            setLoading(false);
        }
    };

    const fetchGroupPosts = async (status = postStatusFilter, author = filterAuthorId) => {
        try {
            let url = `/social-groups/${id}/posts?status=${status}`;
            if (author) {
                url += `&authorId=${author}`;
            }
            const res = await api.get(url);
            if (res.data && res.data.success) {
                setPosts(res.data.data.posts || []);
            }
        } catch (err) {
            // Silently handle
        }
    };

    const handleFilterStatusChange = (status) => {
        setPostStatusFilter(status);
        fetchGroupPosts(status);
    };

    const fetchPendingPosts = async () => {
        try {
            const res = await api.get(`/social-groups/${id}/posts?status=pending`);
            if (res.data && res.data.success) {
                setPendingPosts(res.data.data.posts || []);
            }
        } catch (err) {
            // Silently handle
        }
    };

    const fetchGroupMembers = async () => {
        try {
            const res = await api.get(`/social-groups/${id}/members?status=approved`);
            if (res.data && res.data.success) {
                setMembers(res.data.data || []);
            }
        } catch (err) {
            // Silently handle
        }
    };

    const fetchPendingMembers = async () => {
        try {
            const res = await api.get(`/social-groups/${id}/members?status=pending`);
            if (res.data && res.data.success) {
                setPendingMembers(res.data.data || []);
            }
        } catch (err) {
            // Silently handle
        }
    };

    const handleTogglePostApproval = async () => {
        if (!group) return;
        const newApprovalSetting = !group.post_approval_required;
        const confirmMsg = newApprovalSetting
            ? "Bạn có chắc chắn muốn BẬT chế độ kiểm duyệt bài viết? (Các bài đăng của thành viên sẽ cần Admin/Moderator duyệt trước khi hiển thị)"
            : "Bạn có chắc chắn muốn TẮT chế độ kiểm duyệt bài viết? (Thành viên có thể đăng bài trực tiếp không cần duyệt)";
        
        const isConfirmed = await confirm({
            title: "Cài đặt kiểm duyệt nhóm",
            message: confirmMsg,
            confirmText: "Xác nhận thay đổi",
            type: "warning"
        });
        if (!isConfirmed) return;

        setUpdatingSettings(true);
        try {
            const res = await api.put(`/social-groups/${id}/settings`, {
                postApprovalRequired: newApprovalSetting
            });
            if (res.data && res.data.success) {
                setGroup(prev => ({ ...prev, post_approval_required: newApprovalSetting }));
            }
        } catch (err) {
        } finally {
            setUpdatingSettings(false);
        }
    };

    const handleJoinGroup = async () => {
        try {
            const res = await api.post(`/social-groups/${id}/join`);
            if (res.data && res.data.success) {
                fetchGroupDetails();
            }
        } catch (err) {}
    };

    const handleLeaveGroup = async () => {
        const isConfirmed = await confirm({
            title: "Rời khỏi nhóm",
            message: "Bạn có chắc chắn muốn rời khỏi nhóm này không?",
            confirmText: "Rời nhóm",
            type: "danger"
        });
        if (!isConfirmed) return;
        try {
            const res = await api.post(`/social-groups/${id}/leave`);
            if (res.data && res.data.success) {
                fetchGroupDetails();
            }
        } catch (err) {}
    };

    const handleApproveMember = async (userId) => {
        try {
            const res = await api.post(`/social-groups/${id}/members/${userId}/approve`);
            if (res.data && res.data.success) {
                fetchPendingMembers();
                fetchGroupMembers();
                setGroup(prev => ({
                    ...prev,
                    _count: {
                        ...prev._count,
                        members: (prev._count?.members || 0) + 1
                    }
                }));
            }
        } catch (err) {}
    };

    const handleRemoveMember = async (userId) => {
        const isConfirmed = await confirm({
            title: "Xóa thành viên",
            message: "Bạn có chắc chắn muốn xóa thành viên này khỏi nhóm?",
            confirmText: "Xóa thành viên",
            type: "danger"
        });
        if (!isConfirmed) return;
        try {
            const res = await api.delete(`/social-groups/${id}/members/${userId}/remove`);
            if (res.data && res.data.success) {
                fetchGroupMembers();
                setGroup(prev => ({
                    ...prev,
                    _count: {
                        ...prev._count,
                        members: Math.max((prev._count?.members || 0) - 1, 1)
                    }
                }));
            }
        } catch (err) {}
    };

    const handleRoleChange = async (userId, newRole) => {
        setUpdatingRoleId(userId);
        try {
            const res = await api.put(`/social-groups/${id}/members/${userId}/role`, { role: newRole });
            if (res.data && res.data.success) {
                setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: newRole } : m));
            }
        } catch (err) {
        } finally {
            setUpdatingRoleId(null);
        }
    };

    const handleApprovePost = async (postId) => {
        try {
            const res = await api.post(`/social-groups/${id}/posts/${postId}/approve`);
            if (res.data && res.data.success) {
                fetchPendingPosts();
                fetchGroupPosts(postStatusFilter);
            }
        } catch (err) {}
    };

    const handleRejectPost = async (postId) => {
        const reason = await confirm({
            title: "Từ chối bài viết",
            message: "Vui lòng nhập lý do từ chối bài đăng này để thông báo cho người viết:",
            confirmText: "Từ chối bài viết",
            type: "warning",
            showInput: true,
            inputPlaceholder: "Nhập lý do từ chối...",
            initialInputValue: "Bài viết không phù hợp với quy định của nhóm"
        });
        if (reason === false) return;
        try {
            const res = await api.post(`/social-groups/${id}/posts/${postId}/reject`, { reason });
            if (res.data && res.data.success) {
                fetchPendingPosts();
                fetchGroupPosts(postStatusFilter);
            }
        } catch (err) {}
    };

    const handleDeletePostInGroup = async (postId) => {
        const isConfirmed = await confirm({
            title: "Xóa vĩnh viễn bài viết",
            message: "Bạn có chắc chắn muốn xóa vĩnh viễn bài viết này khỏi hệ thống?",
            confirmText: "Xóa vĩnh viễn",
            type: "danger"
        });
        if (!isConfirmed) return;
        try {
            const res = await api.delete(`/social-groups/${id}/posts/${postId}`);
            if (res.data && res.data.success) {
                fetchGroupPosts(postStatusFilter);
                fetchPendingPosts();
            }
        } catch (err) {}
    };

    const handleMediaUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploadingMedia(true);
        try {
            const uploadedIds = [];
            const previews = [];

            for (const file of files) {
                const formData = new FormData();
                formData.append("file", file);

                const res = await api.post("/media/upload", formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
                if (res.data && res.data.id) {
                    uploadedIds.push(res.data.id);
                    previews.push(getMediaFileUrl(res.data.id));
                }
            }

            setMediaIds(prev => [...prev, ...uploadedIds]);
            setMediaPreviews(prev => [...prev, ...previews]);
        } catch (err) {
        } finally {
            setUploadingMedia(false);
        }
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();
        if (!newPostContent.trim() && mediaIds.length === 0) return;

        try {
            const res = await api.post(`/social-groups/${id}/posts`, {
                content: newPostContent,
                mediaIds: mediaIds
            });

            if (res.data && res.data.success) {
                setNewPostContent("");
                setMediaIds([]);
                setMediaPreviews([]);
                
                if (res.data.data?.status === "pending") {
                    setFilterAuthorId(user?.id);
                    setPostStatusFilter("pending");
                    fetchGroupPosts("pending", user?.id);
                    setActiveTab("posts");
                } else {
                    setFilterAuthorId(null);
                    setPostStatusFilter("approved");
                    fetchGroupPosts("approved", null);
                    setActiveTab("posts");
                }
            }
        } catch (err) {}
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-on-surface-variant text-sm">Đang tải dữ liệu nhóm...</p>
            </div>
        );
    }

    if (!group) return null;

    const isAdminOrMod = group.currentUserRole === "admin" || group.currentUserRole === "moderator";
    const isApprovedMember = group.currentUserMemberStatus === "approved";

    return (
        <div className="space-y-6 pb-12">
            {/* Back to list Link */}
            <Link to="/groups" className="inline-flex items-center space-x-1.5 text-on-surface-variant hover:text-on-surface text-sm font-semibold transition cursor-pointer">
                <MaterialIcon name="arrow_back" size={18} />
                <span>Quay lại danh sách nhóm</span>
            </Link>

            {/* Group Header Card */}
            <div className="bg-surface-container-low/60 dark:bg-surface-container-low/80 backdrop-blur-2xl rounded-3xl border border-outline-variant/10 shadow-sm relative z-20">
                {/* Cover Photo */}
                <div className="h-44 md:h-60 bg-gradient-to-r from-primary-container via-surface-container-high to-secondary-container relative rounded-t-3xl overflow-hidden">
                    {group.cover_url && (
                        <img src={group.cover_url} alt="Cover" className="w-full h-full object-cover" />
                    )}
                </div>

                {/* Profile Details area */}
                <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-10 md:-mt-14 relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4 min-w-0">
                        <img
                            src={group.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${group.name}`}
                            alt={group.name}
                            className="w-20 h-20 md:w-28 md:h-28 rounded-2xl object-cover border-4 border-surface shadow-md bg-surface-container-low shrink-0"
                        />
                        <div className="min-w-0 pb-1">
                            <h2 className="text-xl md:text-2xl font-black text-on-surface truncate">{group.name}</h2>
                            <p className="text-xs md:text-sm text-on-surface-variant mt-1 flex items-center space-x-2">
                                {group.privacy === "public" ? <MaterialIcon name="public" size={16} /> : <MaterialIcon name="lock" size={16} />}
                                <span>Nhóm {group.privacy === "public" ? "Công khai" : "Riêng tư"}</span>
                                <span>•</span>
                                <MaterialIcon name="groups" size={16} />
                                <span>{group._count?.members || 0} thành viên</span>
                            </p>
                        </div>
                    </div>

                    {/* Join / Status / Dropdown Buttons */}
                    <div className="shrink-0 flex items-center space-x-2">
                        {group.currentUserMemberStatus === null ? (
                            <button
                                onClick={handleJoinGroup}
                                className="bg-primary hover:bg-primary-container hover:text-on-primary-container text-on-primary font-semibold text-sm px-6 py-2.5 rounded-xl shadow-md active:scale-95 transition cursor-pointer"
                            >
                                Tham gia nhóm
                            </button>
                        ) : group.currentUserMemberStatus === "pending" ? (
                            <div className="flex items-center space-x-1.5 bg-surface-container-high/60 text-on-surface-variant px-4 py-2.5 rounded-xl text-sm font-semibold border border-outline-variant/10">
                                <MaterialIcon name="schedule" size={16} className="animate-spin text-primary" />
                                <span>Đang chờ duyệt vào nhóm</span>
                            </div>
                        ) : (
                            <span className="bg-tertiary-container/30 text-tertiary text-xs font-bold px-3.5 py-2 rounded-xl border border-tertiary/20 flex items-center space-x-1.5">
                                <MaterialIcon name="check" size={16} />
                                <span>Đã tham gia ({group.currentUserRole === "admin" ? "Admin" : group.currentUserRole === "moderator" ? "Moderator" : "Thành viên"})</span>
                            </span>
                        )}

                        {/* Menu dropdown ... (nằm ngang) */}
                        <div ref={headerMenuRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                                className="p-2.5 bg-surface-container-high/60 hover:bg-surface-container-highest border border-outline-variant/20 rounded-xl text-on-surface-variant hover:text-on-surface transition cursor-pointer flex items-center justify-center shadow-sm"
                                title="Tùy chọn nhóm"
                            >
                                <MaterialIcon name="more_horiz" size={20} />
                            </button>

                            {showHeaderMenu && (
                                <div className="absolute right-0 top-11 z-50 w-60 max-h-80 overflow-y-auto bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/20 rounded-2xl shadow-2xl py-2 text-sm text-on-surface animate-fade-in space-y-1">
                                    {/* 1. MỤC BÀI VIẾT CỦA TÔI */}
                                    <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 border-b border-outline-variant/10 pb-1.5 mb-1">
                                        📌 Bài viết của tôi
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowHeaderMenu(false);
                                            setFilterAuthorId(user?.id);
                                            setPostStatusFilter("approved");
                                            fetchGroupPosts("approved", user?.id);
                                            setActiveTab("posts");
                                        }}
                                        className={`w-full text-left px-4 py-2 hover:bg-primary-container/20 flex items-center justify-between transition cursor-pointer text-xs ${filterAuthorId === user?.id && postStatusFilter === "approved" ? "text-primary font-bold bg-primary-container/10" : ""}`}
                                    >
                                        <span className="flex items-center space-x-2">
                                            <MaterialIcon name="check_circle" size={16} className="text-primary" />
                                            <span>Bài viết đã duyệt</span>
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowHeaderMenu(false);
                                            setFilterAuthorId(user?.id);
                                            setPostStatusFilter("pending");
                                            fetchGroupPosts("pending", user?.id);
                                            setActiveTab("posts");
                                        }}
                                        className={`w-full text-left px-4 py-2 hover:bg-tertiary-container/20 flex items-center justify-between transition cursor-pointer text-xs ${filterAuthorId === user?.id && postStatusFilter === "pending" ? "text-tertiary font-bold bg-tertiary-container/10" : ""}`}
                                    >
                                        <span className="flex items-center space-x-2">
                                            <MaterialIcon name="schedule" size={16} className="text-tertiary" />
                                            <span>Bài viết chờ duyệt</span>
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowHeaderMenu(false);
                                            setFilterAuthorId(user?.id);
                                            setPostStatusFilter("rejected");
                                            fetchGroupPosts("rejected", user?.id);
                                            setActiveTab("posts");
                                        }}
                                        className={`w-full text-left px-4 py-2 hover:bg-error-container/20 flex items-center justify-between transition cursor-pointer text-xs ${filterAuthorId === user?.id && postStatusFilter === "rejected" ? "text-error font-bold bg-error-container/10" : ""}`}
                                    >
                                        <span className="flex items-center space-x-2">
                                            <MaterialIcon name="cancel" size={16} className="text-error" />
                                            <span>Bài viết bị từ chối</span>
                                        </span>
                                    </button>

                                    <div className="border-t border-outline-variant/10 my-1" />

                                    {/* 2. CHIA SẺ & BÁO CÁO NHÓM */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowHeaderMenu(false);
                                            navigator.clipboard?.writeText(window.location.href);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-surface-container-highest/60 flex items-center space-x-2 transition cursor-pointer text-xs text-on-surface"
                                    >
                                        <MaterialIcon name="share" size={16} className="text-on-surface-variant" />
                                        <span>Chia sẻ nhóm này</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowHeaderMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-surface-container-highest/60 flex items-center space-x-2 transition cursor-pointer text-xs text-on-surface-variant"
                                    >
                                        <MaterialIcon name="flag" size={16} className="text-on-surface-variant" />
                                        <span>Báo cáo nhóm</span>
                                    </button>

                                    {/* 3. RỜI NHÓM (Chỉ hiện cho thành viên đã tham gia và không phải Admin) */}
                                    {group.currentUserRole !== "admin" && isApprovedMember && (
                                        <>
                                            <div className="border-t border-outline-variant/10 my-1" />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowHeaderMenu(false);
                                                    handleLeaveGroup();
                                                }}
                                                className="w-full text-left px-4 py-2 hover:bg-error-container/30 text-error flex items-center space-x-2 transition cursor-pointer text-xs font-semibold"
                                            >
                                                <MaterialIcon name="logout" size={16} />
                                                <span>Rời khỏi nhóm</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Group Description Block */}
                {group.description && (
                    <div className="px-6 md:px-8 pb-6 border-b border-outline-variant/10">
                        <p className="text-on-surface-variant text-sm leading-relaxed">{group.description}</p>
                    </div>
                )}

                {/* Navigation Tabs */}
                {(group.privacy === "public" || isApprovedMember) && (
                    <div className="flex border-t border-outline-variant/10 px-6 md:px-8 bg-surface-container-low/40">
                        <button
                            onClick={() => setActiveTab("posts")}
                            className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition cursor-pointer ${activeTab === "posts" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
                        >
                            Thảo luận
                        </button>
                        <button
                            onClick={() => setActiveTab("members")}
                            className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition cursor-pointer ${activeTab === "members" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
                        >
                            Thành viên ({group._count?.members || 0})
                        </button>
                        {isAdminOrMod && (
                            <button
                                onClick={() => setActiveTab("moderation")}
                                className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${activeTab === "moderation" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
                            >
                                <MaterialIcon name="security" size={16} className="text-primary" />
                                <span>Kiểm duyệt ({pendingPosts.length + pendingMembers.length})</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* TAB CONTENTS */}
            {group.privacy === "private" && !isApprovedMember ? (
                <div className="bg-surface-container-low/60 p-12 text-center rounded-3xl border border-outline-variant/10 shadow-sm space-y-3">
                    <MaterialIcon name="lock" size={48} className="text-on-surface-variant/40 mx-auto" />
                    <h3 className="text-lg font-bold text-on-surface">Đây là nhóm Riêng tư (Private)</h3>
                    <p className="text-on-surface-variant text-sm max-w-md mx-auto">Chỉ các thành viên đã được phê duyệt mới có thể xem các bài đăng và danh sách thành viên trong nhóm này.</p>
                    {group.currentUserMemberStatus === null && (
                        <button
                            onClick={handleJoinGroup}
                            className="mt-4 bg-primary hover:bg-primary-container hover:text-on-primary-container text-on-primary text-sm font-semibold px-6 py-2.5 rounded-xl cursor-pointer shadow-md"
                        >
                            Yêu cầu tham gia nhóm
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-3">
                    {/* Main Area */}
                    <div className="md:col-span-2 space-y-6">
                        {activeTab === "posts" && (
                            <>
                                {/* Create Post block (Only visible for approved members) */}
                                {isApprovedMember && (
                                    <form onSubmit={handleCreatePost} className="bg-surface-container-low/60 p-5 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4">
                                        <div className="flex items-start space-x-3.5">
                                            <textarea
                                                placeholder={`Đăng bài viết thảo luận trong nhóm ${group.name}...`}
                                                rows="3"
                                                value={newPostContent}
                                                onChange={(e) => setNewPostContent(e.target.value)}
                                                className="w-full bg-surface-container/60 focus:bg-surface border border-outline-variant/10 focus:border-primary rounded-xl px-4 py-3 text-on-surface outline-none placeholder:text-on-surface-variant/50 transition text-sm resize-none"
                                            />
                                        </div>

                                        {/* Image Previews */}
                                        {mediaPreviews.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2 border-t border-outline-variant/10 pt-3">
                                                {mediaPreviews.map((src, i) => (
                                                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant/20">
                                                        <img src={src} className="w-full h-full object-cover" alt="Preview" />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setMediaIds(prev => prev.filter((_, idx) => idx !== i));
                                                                setMediaPreviews(prev => prev.filter((_, idx) => idx !== i));
                                                            }}
                                                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-black cursor-pointer"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between border-t border-outline-variant/10 pt-3.5">
                                            <label className="flex items-center space-x-2 text-on-surface-variant hover:text-on-surface transition cursor-pointer">
                                                <MaterialIcon name="image" size={20} className="text-tertiary" />
                                                <span className="text-xs font-semibold">Thêm hình ảnh</span>
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*"
                                                    onChange={handleMediaUpload}
                                                    className="hidden"
                                                />
                                            </label>

                                            <button
                                                type="submit"
                                                disabled={uploadingMedia || (!newPostContent.trim() && mediaIds.length === 0)}
                                                className="flex items-center justify-center space-x-1.5 bg-primary hover:bg-primary-container hover:text-on-primary-container text-on-primary text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                                            >
                                                <MaterialIcon name="send" size={14} />
                                                <span>{group.post_approval_required && group.currentUserRole === "member" ? "Gửi duyệt bài" : "Đăng bài"}</span>
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* Active Filter Banner (hiển thị khi lọc qua menu ...) */}
                                {(filterAuthorId || postStatusFilter !== "approved") && (
                                    <div className="bg-surface-container-high/60 border border-outline-variant/10 p-4 rounded-2xl flex items-center justify-between text-xs animate-fade-in">
                                        <div className="flex items-center space-x-2 font-semibold text-on-surface">
                                            <MaterialIcon name="filter_alt" size={18} className="text-primary" />
                                            <span>
                                                Đang hiển thị: <strong>
                                                    {filterAuthorId === user?.id ? "Bài viết của tôi" : "Tất cả bài"} (
                                                    {postStatusFilter === "approved" ? "Đã duyệt" : postStatusFilter === "pending" ? "Đang chờ duyệt" : "Bị từ chối"}
                                                    )
                                                </strong>
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilterAuthorId(null);
                                                setPostStatusFilter("approved");
                                                fetchGroupPosts("approved", null);
                                            }}
                                            className="text-primary hover:underline font-bold text-xs cursor-pointer flex items-center space-x-1 bg-surface-container/60 px-3 py-1.5 rounded-xl border border-outline-variant/20"
                                        >
                                            <span>Xem tất cả bài nhóm</span>
                                            <MaterialIcon name="close" size={14} />
                                        </button>
                                    </div>
                                )}

                                {/* Posts List */}
                                <div className="space-y-4">
                                    {posts.length === 0 ? (
                                        <div className="bg-surface-container-low/60 p-12 text-center border border-outline-variant/10 rounded-3xl">
                                            <MaterialIcon name="inbox" size={40} className="text-on-surface-variant/40 mx-auto mb-2" />
                                            <p className="text-on-surface-variant text-sm">
                                                {postStatusFilter === "approved"
                                                    ? "Chưa có bài viết nào được phê duyệt trong nhóm này."
                                                    : postStatusFilter === "pending"
                                                    ? "Không có bài viết nào đang chờ duyệt."
                                                    : "Không có bài viết nào bị từ chối."}
                                            </p>
                                        </div>
                                    ) : (
                                        posts.map((post) => (
                                            <div key={post.id} className="relative space-y-2">
                                                {/* Header Status Badge if not approved */}
                                                {post.status === "pending" && (
                                                    <div className="bg-tertiary-container/40 text-tertiary border border-tertiary/20 px-4 py-2 rounded-2xl text-xs font-semibold flex items-center justify-between">
                                                        <span className="flex items-center space-x-1.5">
                                                            <MaterialIcon name="schedule" size={16} />
                                                            <span>Bài viết này đang chờ Admin/Moderator kiểm duyệt</span>
                                                        </span>
                                                        {isAdminOrMod && (
                                                            <div className="flex items-center space-x-2">
                                                                <button
                                                                    onClick={() => handleApprovePost(post.id)}
                                                                    className="bg-primary hover:bg-primary-container text-on-primary text-[11px] font-bold px-3 py-1 rounded-lg cursor-pointer"
                                                                >
                                                                    Duyệt ngay
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRejectPost(post.id)}
                                                                    className="bg-error-container/40 text-error text-[11px] font-bold px-3 py-1 rounded-lg cursor-pointer"
                                                                >
                                                                    Từ chối
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {post.status === "rejected" && (
                                                    <div className="bg-error-container/30 text-error border border-error/20 p-4 rounded-2xl text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in my-2">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center space-x-1.5 font-bold text-sm">
                                                                <MaterialIcon name="cancel" size={18} />
                                                                <span>Bài viết này đã bị từ chối phê duyệt</span>
                                                            </div>
                                                            <p className="text-xs text-error/90 pl-6">
                                                                <strong>📝 Lý do từ chối:</strong> {post.rejection_reason || post.rejectionReason || "Bài viết không phù hợp với quy định của nhóm."}
                                                            </p>
                                                        </div>
                                                        {isAdminOrMod && (
                                                            <div className="flex items-center space-x-2 shrink-0">
                                                                <button
                                                                    onClick={() => handleApprovePost(post.id)}
                                                                    className="bg-primary hover:bg-primary/90 text-on-primary text-[11px] font-bold px-3 py-1.5 rounded-xl cursor-pointer shadow-sm transition"
                                                                >
                                                                    Duyệt lại
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeletePostInGroup(post.id)}
                                                                    className="bg-error hover:bg-error/90 text-on-error text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-sm transition"
                                                                >
                                                                    Xóa vĩnh viễn
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <PostCard
                                                    post={{
                                                        ...post,
                                                        isGroupAdmin: isAdminOrMod,
                                                        currentUserRole: group.currentUserRole
                                                    }}
                                                    currentUserId={user?.id}
                                                    hideGroupBadge={true}
                                                    onPostDeleted={(deletedId) => {
                                                        setPosts(prev => prev.filter(p => p.id !== deletedId));
                                                    }}
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}

                        {activeTab === "members" && (
                            <div className="bg-surface-container-low/60 p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-6">
                                {/* Header & Controls */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/10">
                                    <div>
                                        <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                                            <MaterialIcon name="groups" size={22} className="text-primary" />
                                            <span>Thành viên nhóm</span>
                                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container">
                                                {members.length}
                                            </span>
                                        </h3>
                                        <p className="text-xs text-on-surface-variant mt-0.5">Quản lý danh sách và phân quyền thành viên trong cộng đồng</p>
                                    </div>

                                    {/* Search input */}
                                    <div className="relative min-w-[200px]">
                                        <MaterialIcon name="search" size={16} className="text-on-surface-variant/50 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Tìm thành viên..."
                                            value={memberSearch}
                                            onChange={(e) => setMemberSearch(e.target.value)}
                                            className="w-full bg-surface-container/60 border border-outline-variant/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition"
                                        />
                                    </div>
                                </div>

                                {/* Role Filter Tabs */}
                                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                                    {[
                                        { key: "all", label: "Tất cả", count: members.length },
                                        { key: "admin", label: "Quản trị viên", count: members.filter(m => m.role === "admin" || m.user_id === group?.created_by).length },
                                        { key: "moderator", label: "Kiểm duyệt viên", count: members.filter(m => m.role === "moderator").length },
                                        { key: "member", label: "Thành viên", count: members.filter(m => m.role === "member" && m.user_id !== group?.created_by).length },
                                    ].map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setMemberRoleFilter(tab.key)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                                                memberRoleFilter === tab.key
                                                    ? "bg-primary-container text-on-primary-container"
                                                    : "bg-surface-container/60 text-on-surface-variant hover:bg-surface-container-high/60"
                                            }`}
                                        >
                                            <span>{tab.label}</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                                memberRoleFilter === tab.key ? "bg-primary/20 text-primary" : "bg-surface-container-high text-on-surface-variant"
                                            }`}>
                                                {tab.count}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {/* Members List */}
                                <div className="divide-y divide-outline-variant/10">
                                    {members
                                        .filter(m => {
                                            const matchesSearch = !memberSearch || (m.displayName && m.displayName.toLowerCase().includes(memberSearch.toLowerCase()));
                                            const isOwner = m.user_id === group?.created_by;
                                            if (memberRoleFilter === "admin") return matchesSearch && (m.role === "admin" || isOwner);
                                            if (memberRoleFilter === "moderator") return matchesSearch && m.role === "moderator";
                                            if (memberRoleFilter === "member") return matchesSearch && m.role === "member" && !isOwner;
                                            return matchesSearch;
                                        })
                                        .map((m) => {
                                            const isOwner = m.user_id === group?.created_by;
                                            return (
                                                <div key={m.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 hover:bg-surface-container-high/40 px-2 rounded-xl transition">
                                                    <Link to={`/groups/${id}/user/${m.user_id}`} className="flex items-center space-x-3 cursor-pointer group">
                                                        <div className="relative">
                                                            <img
                                                                src={m.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${m.displayName}`}
                                                                alt={m.displayName}
                                                                className="w-11 h-11 rounded-full object-cover border border-outline-variant/20 group-hover:scale-105 transition"
                                                            />
                                                            {isOwner && (
                                                                <div className="absolute -bottom-0.5 -right-0.5 bg-tertiary text-on-tertiary p-0.5 rounded-full ring-2 ring-surface">
                                                                    <MaterialIcon name="workspace_premium" size={12} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h5 className="font-bold text-on-surface text-sm group-hover:text-primary transition">{m.displayName}</h5>
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-1.5">
                                                                {isOwner ? (
                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-tertiary-container/40 text-tertiary border border-tertiary/20">
                                                                        <MaterialIcon name="workspace_premium" size={12} />
                                                                        <span>Trưởng nhóm</span>
                                                                    </span>
                                                                ) : m.role === "admin" ? (
                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-error-container/40 text-error border border-error/20">
                                                                        <MaterialIcon name="admin_panel_settings" size={12} />
                                                                        <span>Quản trị viên</span>
                                                                    </span>
                                                                ) : m.role === "moderator" ? (
                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary border border-secondary/20">
                                                                        <MaterialIcon name="security" size={12} />
                                                                        <span>Kiểm duyệt viên</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-surface-container/60 text-on-surface-variant border border-outline-variant/10">
                                                                        <MaterialIcon name="person" size={12} />
                                                                        <span>Thành viên</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Link>

                                                    {/* Action controls (only for admin) */}
                                                    {group.currentUserRole === "admin" && (
                                                        <div className="flex items-center space-x-2">
                                                            {isOwner ? (
                                                                <span className="text-xs font-semibold text-tertiary bg-tertiary-container/30 px-3 py-1 rounded-xl border border-tertiary/20">
                                                                    Chủ sở hữu
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <div className="relative">
                                                                        <select
                                                                            value={m.role}
                                                                            disabled={updatingRoleId === m.user_id}
                                                                            onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                                                                            className="appearance-none bg-surface-container/60 hover:bg-surface-container-high/60 border border-outline-variant/10 text-on-surface text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 cursor-pointer focus:border-primary transition outline-none disabled:opacity-50"
                                                                        >
                                                                            <option value="member">👤 Thành viên</option>
                                                                            <option value="moderator">🛡️ Kiểm duyệt viên</option>
                                                                            <option value="admin">👑 Quản trị viên</option>
                                                                        </select>
                                                                        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
                                                                            <MaterialIcon name="expand_more" size={16} />
                                                                        </div>
                                                                    </div>

                                                                    <button
                                                                        onClick={() => handleRemoveMember(m.user_id)}
                                                                        className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded-xl transition border border-transparent hover:border-error/20 cursor-pointer"
                                                                        title="Mời khỏi nhóm"
                                                                    >
                                                                        <MaterialIcon name="person_remove" size={16} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {activeTab === "moderation" && isAdminOrMod && (
                            <div className="space-y-6">
                                {/* Admin Moderation Settings Card */}
                                {group.currentUserRole === "admin" && (
                                    <div className="bg-surface-container-low/60 p-6 rounded-3xl border border-outline-variant/10 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <h4 className="font-bold text-on-surface text-base flex items-center gap-2">
                                                <MaterialIcon name="admin_panel_settings" size={22} className="text-primary" />
                                                <span>Cấu hình chế độ kiểm duyệt bài viết</span>
                                            </h4>
                                            <p className="text-xs text-on-surface-variant max-w-md">
                                                {group.post_approval_required
                                                    ? "Đang BẬT: Mọi bài đăng của thành viên cần được Admin / Moderator phê duyệt trước khi xuất hiện trên bảng tin nhóm."
                                                    : "Đang TẮT: Thành viên có thể đăng bài tự do, bài hiển thị ngay lập tức không cần duyệt."}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleTogglePostApproval}
                                            disabled={updatingSettings}
                                            className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition cursor-pointer flex items-center space-x-2 shrink-0 disabled:opacity-50 ${
                                                group.post_approval_required
                                                    ? "bg-primary hover:bg-primary/90 text-on-primary shadow-md"
                                                    : "bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant border border-outline-variant/20"
                                            }`}
                                        >
                                            <MaterialIcon name={group.post_approval_required ? "verified_user" : "gavel"} size={18} />
                                            <span>{group.post_approval_required ? "Bật (Yêu cầu duyệt)" : "Tắt (Tự do đăng bài)"}</span>
                                        </button>
                                    </div>
                                )}

                                {/* Pending Posts section */}
                                <div className="bg-surface-container-low/60 p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4">
                                    <h3 className="text-lg font-bold text-on-surface flex items-center space-x-2">
                                        <MaterialIcon name="security" size={20} className="text-primary" />
                                        <span>Bài viết đang chờ phê duyệt ({pendingPosts.length})</span>
                                    </h3>

                                    {pendingPosts.length === 0 ? (
                                        <p className="text-on-surface-variant text-sm">Không có bài viết nào đang chờ duyệt.</p>
                                    ) : (
                                        <div className="space-y-6">
                                            {pendingPosts.map((post) => (
                                                <div key={post.id} className="border border-outline-variant/10 rounded-2xl p-4 bg-surface-container/40 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-2.5">
                                                            <img
                                                                src={post.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                                className="w-8 h-8 rounded-full border object-cover"
                                                                alt="Author"
                                                            />
                                                            <div>
                                                                <h6 className="font-semibold text-on-surface text-sm">{post.author?.displayName}</h6>
                                                                <p className="text-[10px] text-on-surface-variant font-mono">{new Date(post.created_at).toLocaleString()}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <button
                                                                onClick={() => handleApprovePost(post.id)}
                                                                className="bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                                                            >
                                                                Duyệt đăng
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectPost(post.id)}
                                                                className="bg-error-container/30 text-error hover:bg-error-container/60 text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                                                            >
                                                                Từ chối
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <p className="text-on-surface text-sm whitespace-pre-wrap">{post.content}</p>

                                                    {post.media_ids && post.media_ids.length > 0 && (
                                                        <div className="grid gap-1.5 grid-cols-2">
                                                            {post.media_ids.map((mediaId, idx) => (
                                                                <img
                                                                    key={idx}
                                                                    src={getMediaFileUrl(mediaId)}
                                                                    alt="Media"
                                                                    className="rounded-xl max-h-48 w-full object-cover border border-outline-variant/20"
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Pending Join Requests section */}
                                <div className="bg-surface-container-low/60 p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4">
                                    <h3 className="text-lg font-bold text-on-surface flex items-center space-x-2">
                                        <MaterialIcon name="groups" size={20} className="text-primary" />
                                        <span>Yêu cầu tham gia nhóm chờ duyệt ({pendingMembers.length})</span>
                                    </h3>

                                    {pendingMembers.length === 0 ? (
                                        <p className="text-on-surface-variant text-sm">Không có yêu cầu tham gia nào đang chờ duyệt.</p>
                                    ) : (
                                        <div className="divide-y divide-outline-variant/10">
                                            {pendingMembers.map((m) => (
                                                <div key={m.id} className="flex items-center justify-between py-3">
                                                    <Link to={`/groups/${id}/user/${m.user_id}`} className="flex items-center space-x-3 group">
                                                        <img
                                                            src={m.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${m.displayName}`}
                                                            alt={m.displayName}
                                                            className="w-10 h-10 rounded-full object-cover border border-outline-variant/20 group-hover:opacity-80 transition"
                                                        />
                                                        <div>
                                                            <h5 className="font-semibold text-on-surface text-sm group-hover:text-primary transition">{m.displayName}</h5>
                                                            <span className="text-[10px] text-on-surface-variant">Yêu cầu tham gia {new Date(m.joined_at).toLocaleDateString()}</span>
                                                        </div>
                                                    </Link>

                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => handleApproveMember(m.user_id)}
                                                            className="bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                                                        >
                                                            Duyệt tham gia
                                                        </button>
                                                        <button
                                                            onClick={() => handleRemoveMember(m.user_id)}
                                                            className="text-on-surface-variant hover:bg-surface-container-high/60 text-xs font-semibold px-3 py-1.5 border border-outline-variant/10 rounded-lg transition cursor-pointer"
                                                        >
                                                            Từ chối
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Area */}
                    <div className="space-y-6">
                        {/* Rules card */}
                        <div className="bg-surface-container-low/60 p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4">
                            <h4 className="font-bold text-on-surface flex items-center space-x-2">
                                <MaterialIcon name="security" size={20} className="text-primary" />
                                <span>Quy tắc hoạt động</span>
                            </h4>
                            <ul className="text-on-surface-variant text-xs space-y-3 leading-relaxed">
                                <li className="flex items-start space-x-2">
                                    <span className="bg-primary-container text-on-primary-container font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">1</span>
                                    <span>Tôn trọng ý kiến mọi thành viên trong cộng đồng.</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <span className="bg-primary-container text-on-primary-container font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">2</span>
                                    <span>Chia sẻ thông tin hữu ích và không spam quảng cáo.</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <span className="bg-primary-container text-on-primary-container font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">3</span>
                                    <span>Mọi bài viết vi phạm sẽ bị xóa và chặn vĩnh viễn.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupDetail;
