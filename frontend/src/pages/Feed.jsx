import { useState, useEffect } from "react";
import api from "../services/api";
import CreatePost from "../components/CreatePost";
import PostCard from "../components/PostCard";
import StoryBar from "../components/stories/StoryBar";
import { useAuth } from "../context/AuthContext";
import MaterialIcon from "../components/MaterialIcon";

const Feed = () => {
    const { user } = useAuth();
    const [posts, setPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchFeed = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/feed");
            if (res.data && res.data.success) {
                setPosts(res.data.data || []);
            }
        } catch (error) {
            console.error("❌ Lỗi lấy bảng tin:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFeed();
    }, []);

    const handlePostCreated = (newPost) => {
        const postWithAuthor = {
            ...newPost,
            author: {
                id: user.id,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
            },
            isLikedByMe: false,
        };
        setPosts((prevPosts) => [postWithAuthor, ...prevPosts]);
    };

    const handlePostShared = (newSharedPost) => {
        setPosts((prevPosts) => [newSharedPost, ...prevPosts]);
    };

    const handlePostDeleted = (deletedPostId) => {
        setPosts((prevPosts) => prevPosts.filter(p => p.id !== deletedPostId));
    };

    const handlePostUpdated = (updatedPost) => {
        setPosts((prevPosts) => prevPosts.map(p => p.id === updatedPost.id ? updatedPost : p));
    };

    return (
        <div className="space-y-8">
            {/* Header Universe (discoveryscreen.html style) */}
            <div className="mb-6 sm:mb-8">
                <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight flex items-center gap-3">
                    <MaterialIcon name="public" size={36} />
                    <span>Bảng Tin</span>
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant mt-2">Cập nhật những hoạt động mới nhất từ bạn bè của bạn.</p>
            </div>

            {/* Thanh Story 24h */}
            <StoryBar />

            {/* Hộp đăng bài */}
            <CreatePost onPostCreated={handlePostCreated} />

            {/* Danh sách bài viết */}
            {isLoading ? (
                <div className="flex justify-center py-16">
                    <MaterialIcon name="progress_activity" size={36} className="text-primary animate-spin" />
                </div>
            ) : posts.length > 0 ? (
                <div className="space-y-6">
                    {posts.map((post) => (
                        <PostCard 
                            key={post.id} 
                            post={post} 
                            currentUserId={user?.id} 
                            onPostShared={handlePostShared} 
                            onPostDeleted={handlePostDeleted} 
                            onPostUpdated={handlePostUpdated}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-2xl border border-outline-variant/10 rounded-3xl p-8 shadow-sm">
                    <MaterialIcon name="chat_bubble_outline" size={48} className="text-on-surface-variant/40 mx-auto mb-4" />
                    <p className="font-headline-md text-lg text-on-surface">Chưa có bài viết nào ở đây.</p>
                    <p className="font-body-md text-sm text-on-surface-variant mt-1">Hãy là người đầu tiên đăng bài viết hoặc kết bạn mới nhé!</p>
                </div>
            )}
        </div>
    );
};

export default Feed;
