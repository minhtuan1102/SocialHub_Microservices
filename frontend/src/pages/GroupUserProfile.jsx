import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import MaterialIcon from "../components/MaterialIcon";
import api from "../services/api";
import PostCard from "../components/PostCard";

const GroupUserProfile = () => {
    const { groupId, userId } = useParams();
    const navigate = useNavigate();

    const [group, setGroup] = useState(null);
    const [profileUser, setProfileUser] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [groupId, userId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Lấy thông tin Nhóm
            const groupRes = await api.get(`/social-groups/${groupId}`);
            if (groupRes.data && groupRes.data.success) {
                setGroup(groupRes.data.data);
            }

            // 2. Lấy thông tin thành viên (User Profile) từ user-service
            const userRes = await api.get(`/users/${userId}`);
            if (userRes.data && userRes.data.success) {
                setProfileUser(userRes.data.user);
            }

            // 3. Lấy toàn bộ bài đăng của user này trong group
            const postsRes = await api.get(`/social-groups/${groupId}/posts?authorId=${userId}&status=approved`);
            if (postsRes.data && postsRes.data.success) {
                setPosts(postsRes.data.data.posts || []);
            }
        } catch (err) {
            navigate(`/groups/${groupId}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-on-surface-variant text-sm">Đang tải bài viết của thành viên...</p>
            </div>
        );
    }

    if (!group || !profileUser) return null;

    return (
        <div className="space-y-6 pb-12">
            {/* Breadcrumb quay lại nhóm */}
            <Link 
                to={`/groups/${groupId}`} 
                className="inline-flex items-center space-x-1.5 text-on-surface-variant hover:text-on-surface text-sm font-semibold transition cursor-pointer"
            >
                <MaterialIcon name="arrow_back" size={18} />
                <span>Quay lại nhóm {group.name}</span>
            </Link>

            {/* Member Card Summary */}
            <div className="bg-surface-container-low/60 dark:bg-surface-container-low/80 backdrop-blur-2xl rounded-3xl border border-outline-variant/10 shadow-sm p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center space-x-4 min-w-0">
                    <img
                        src={profileUser.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        alt={profileUser.displayName}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-outline-variant/20"
                    />
                    <div className="min-w-0">
                        <h2 className="text-xl sm:text-2xl font-bold text-on-surface truncate">{profileUser.displayName}</h2>
                        <p className="text-on-surface-variant text-xs sm:text-sm mt-1 flex items-center space-x-2">
                            <MaterialIcon name="auto_stories" size={16} className="text-primary" />
                            <span>Bài viết trong nhóm <strong>{group.name}</strong></span>
                        </p>
                        <p className="text-xs text-on-surface-variant/70 mt-1 flex items-center space-x-1">
                            <span>Có {posts.length} bài đăng thảo luận</span>
                        </p>
                    </div>
                </div>

                {/* View Profile Button */}
                <Link
                    to={`/profile/${userId}`}
                    className="flex items-center justify-center space-x-2 bg-primary hover:bg-primary-container hover:text-on-primary-container text-on-primary font-semibold text-sm px-6 py-3 rounded-xl shadow-md active:scale-95 transition cursor-pointer"
                >
                    <MaterialIcon name="person" size={18} />
                    <span>Trang cá nhân</span>
                </Link>
            </div>

            {/* Posts Area */}
            <div className="space-y-4 max-w-2xl mx-auto">
                <h3 className="text-lg font-bold text-on-surface border-b border-outline-variant/10 pb-3">Các bài viết đã duyệt ({posts.length})</h3>
                {posts.length === 0 ? (
                    <div className="bg-surface-container-low/60 p-12 text-center border border-outline-variant/10 rounded-3xl">
                        <p className="text-on-surface-variant text-sm">Thành viên này chưa đăng bài viết nào trong nhóm.</p>
                    </div>
                ) : (
                    posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                    ))
                )}
            </div>
        </div>
    );
};

export default GroupUserProfile;
