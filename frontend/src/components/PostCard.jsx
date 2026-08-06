import {useState, useEffect, useRef} from "react";
import {Link} from "react-router-dom"; // <-- Import thêm Link để điều hướng
import api from "../services/api";
import {getMediaFileUrl} from "../services/mediaUrl";
import MaterialIcon from "./MaterialIcon";
import { Loader } from "lucide-react";
import ShareModal from "./ShareModal";
import EditPostModal from "./EditPostModal";
import ImageLightboxModal from "./ImageLightboxModal";
import HlsVideoPlayer from "./HlsVideoPlayer";
import {useAuth} from "../context/AuthContext";
import {useConfirm} from "../context/ConfirmContext";
import {formatRelativeTime} from "../utils/dateUtils";

const REACTION_OPTIONS = [
    { id: "like", label: "Thích", emoji: "👍", color: "text-blue-600", bg: "bg-blue-50" },
    { id: "love", label: "Yêu thích", emoji: "❤️", color: "text-rose-600", bg: "bg-rose-50" },
    { id: "haha", label: "Haha", emoji: "😆", color: "text-amber-500", bg: "bg-amber-50" },
    { id: "wow", label: "Wow", emoji: "😮", color: "text-amber-500", bg: "bg-amber-50" },
    { id: "sad", label: "Buồn", emoji: "😢", color: "text-amber-500", bg: "bg-amber-50" },
    { id: "angry", label: "Phẫn nộ", emoji: "😡", color: "text-red-600", bg: "bg-red-50" },
];

const PostCard = ({ post, currentUserId, onPostDeleted, onPostShared, onPostUpdated, hideGroupBadge = false }) => {
    const { user: currentUser } = useAuth();
    const confirm = useConfirm(); 
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPostMenu, setShowPostMenu] = useState(false); // Dropdown ... cho bài đăng
    const [lightboxData, setLightboxData] = useState(null); // { items: [...], index: 0 }
    const [isLiked, setIsLiked] = useState(post.isLikedByMe || false);
    const [likeCount, setLikeCount] = useState(post.like_count ?? post.likeCount ?? 0);
    const [selectedReaction, setSelectedReaction] = useState(post.isLikedByMe ? REACTION_OPTIONS[0] : null);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [showReactorsPopover, setShowReactorsPopover] = useState(false);
    const [reactorsList, setReactorsList] = useState([]);
    const [isLoadingReactors, setIsLoadingReactors] = useState(false);
    const reactionPickerTimer = useRef(null);
    const reactorsTimer = useRef(null);
    const [commentCount, setCommentCount] = useState(post.comment_count ?? post.commentCount ?? 0);
    const [shareCount, setShareCount] = useState(post.share_count ?? post.shareCount ?? 0);
    const [imageUrl, setImageUrl] = useState("");
    const [isLoadingImage, setIsLoadingImage] = useState(false);

    // Mở Lightbox Modal với danh sách toàn bộ ảnh của bài viết
    const handleOpenLightbox = (index, itemsList = mediaItems) => {
        setLightboxData({items: itemsList, index});
    };

    // Trạng thái cho bài đăng được chia sẻ
    const [originalPost, setOriginalPost] = useState(null);
    const [originalMediaItems, setOriginalMediaItems] = useState([]);
    const [isLoadingOriginalMedia, setIsLoadingOriginalMedia] = useState(false);
    const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);

    // Trạng thái cho Bình luận
    const [commentsDisabled, setCommentsDisabled] = useState(post.comments_disabled || false);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState("");
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    const handleToggleComments = async () => {
        setShowPostMenu(false);
        try {
            const res = await api.patch(`/posts/${post.id}/toggle-comments`);
            if (res.data && res.data.success) {
                const newDisabledState = res.data.data.comments_disabled;
                setCommentsDisabled(newDisabledState);
            }
        } catch (error) {}
    };

    // Trạng thái cho Share Modal
    const [showShareModal, setShowShareModal] = useState(false);

    const commentInputRef = useRef(null);
    const postMenuRef = useRef(null);
    const [replyingTo, setReplyingTo] = useState(null); // Lưu thông tin comment đang được phản hồi

    // Đóng post menu khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (postMenuRef.current && !postMenuRef.current.contains(e.target)) {
                setShowPostMenu(false);
            }
        };
        if (showPostMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showPostMenu]);

    // Trạng thái cho Tùy chọn Bình luận (Dropdown & Edit)
    const [activeCommentMenu, setActiveCommentMenu] = useState(null);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentText, setEditingCommentText] = useState("");

    const handleStartEditComment = (comment) => {
        setActiveCommentMenu(null);
        setEditingCommentId(comment.id || comment._id);
        setEditingCommentText(comment.parsedInfo?.cleanText || comment.content);
    };

    const handleSaveEditComment = async (commentId, originalPrefix = "") => {
        if (!editingCommentText.trim()) return;
        const finalContent = originalPrefix ? `${originalPrefix} ${editingCommentText.trim()}` : editingCommentText.trim();
        try {
            const res = await api.put(`/posts/${post.id}/comments/${commentId}`, { content: finalContent });
            if (res.data && res.data.success) {
                setComments(prev => prev.map(c => (c.id === commentId || c._id === commentId) ? { ...c, content: finalContent } : c));
                setEditingCommentId(null);
                setEditingCommentText("");
            }
        } catch (error) {}
    };

    const handleReportComment = (commentId) => {
        setActiveCommentMenu(null);
    };

    // Xử lý khi nhấn nút Phản hồi
    const handleReplyClick = (comment) => {
        setReplyingTo(comment);
        setTimeout(() => {
            if (commentInputRef.current) {
                commentInputRef.current.focus();
            }
        }, 100);
    };

    // Hàm phân giải nội dung bình luận để xác định xem có phải là phản hồi không và tag ai, parentId là gì
    const parseComment = (text) => {
        if (!text) return {isReply: false, parentId: null, mentionName: "", cleanText: ""};

        // 1. Dạng mới có parentId và mention: [reply:parentId:@Tên] nội dung
        const matchFull = text.match(/^\[reply:([0-9a-fA-F-]+):@([^\]]+)\]/);
        if (matchFull) {
            return {isReply: true, parentId: matchFull[1], mentionName: matchFull[2], cleanText: text.substring(matchFull[0].length).trim()};
        }

        // 2. Dạng mới chỉ có parentId: [reply:parentId] nội dung
        const matchParent = text.match(/^\[reply:([0-9a-fA-F-]+)\]/);
        if (matchParent) {
            return {isReply: true, parentId: matchParent[1], mentionName: "", cleanText: text.substring(matchParent[0].length).trim()};
        }

        // 3. Dạng cũ không có parentId: [reply] nội dung
        if (text.startsWith("[reply]")) {
            return {isReply: true, parentId: null, mentionName: "", cleanText: text.substring(7).trim()};
        }

        // 4. Dạng cũ: [reply:@Tên] nội dung
        const matchReplyTag = text.match(/^\[reply:@([^\]]+)\]/);
        if (matchReplyTag) {
            return {isReply: true, parentId: null, mentionName: matchReplyTag[1], cleanText: text.substring(matchReplyTag[0].length).trim()};
        }

        // 5. Dạng cũ (tương thích ngược): @Tên: nội dung
        const matchOldTag = text.match(/^@([^:]+):/);
        if (matchOldTag) {
            return {isReply: true, parentId: null, mentionName: matchOldTag[1], cleanText: text.substring(matchOldTag[0].length).trim()};
        }

        return {isReply: false, parentId: null, mentionName: "", cleanText: text};
    };

    // Phân nhóm bình luận: bình luận gốc (parents) và bình luận phản hồi (replies) theo parentId
    const getStructuredComments = () => {
        const parsed = comments.map(c => ({
            ...c,
            parsedInfo: parseComment(c.content)
        }));

        const parents = [];
        const repliesByParent = {}; // parentId -> array of replies

        parsed.forEach(c => {
            const cId = c.id || c._id;

            if (c.parsedInfo.isReply && c.parsedInfo.parentId && parsed.some(p => (p.id || p._id) === c.parsedInfo.parentId)) {
                const pId = c.parsedInfo.parentId;
                if (!repliesByParent[pId]) repliesByParent[pId] = [];
                repliesByParent[pId].push(c);
            } else if (c.parsedInfo.isReply && !c.parsedInfo.parentId) {
                // Hỗ trợ định dạng cũ không có parentId:
                // Tìm comment cha gần nhất được đăng trước đó mà không phải là reply, 
                // hoặc mặc định coi như parent comment
                let foundParent = null;
                const currentIndex = parsed.findIndex(item => (item.id || item._id) === cId);
                for (let i = currentIndex - 1; i >= 0; i--) {
                    if (!parsed[i].parsedInfo.isReply) {
                        foundParent = parsed[i];
                        break;
                    }
                }
                if (foundParent) {
                    const pId = foundParent.id || foundParent._id;
                    if (!repliesByParent[pId]) repliesByParent[pId] = [];
                    repliesByParent[pId].push(c);
                } else {
                    parents.push(c);
                }
            } else {
                parents.push(c);
            }
        });

        return {parents, repliesByParent};
    };

    const [mediaItems, setMediaItems] = useState([]); // [{ id, url, isVideo }]
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);

    // 1. Tải tất cả Media (Ảnh & Video) đính kèm của bài viết
    useEffect(() => {
        const rawMediaList = post.media_ids || post.mediaIds || [];
        if (!rawMediaList || rawMediaList.length === 0) {
            setMediaItems([]);
            setIsLoadingMedia(false);
            return;
        }

        let isSubscribed = true;
        setIsLoadingMedia(true);

        const fetchMediaMeta = async () => {
            try {
                const promises = rawMediaList.map(async (item) => {
                    const mId = typeof item === "string" ? item : (item.id || item._id);
                    try {
                        const metaRes = await api.get(`/media/${mId}`);
                        const mimeType = metaRes.data?.mimeType || "";
                        const isVideo = mimeType.startsWith("video/");
                        const imgUrl = `${api.defaults.baseURL}/media/file/${mId}?variant=medium`;
                        return {id: mId, url: imgUrl, isVideo};
                    } catch (err) {
                        return {id: mId, url: `${api.defaults.baseURL}/media/file/${mId}?variant=medium`, isVideo: true};
                    }
                });
                const results = await Promise.all(promises);
                if (isSubscribed) {
                    setMediaItems(results.filter(Boolean));
                }
            } catch (error) {
                console.error("❌ Lỗi phân loại media:", error.message);
            } finally {
                if (isSubscribed) {
                    setIsLoadingMedia(false);
                }
            }
        };

        fetchMediaMeta();

        return () => {
            isSubscribed = false;
        };
    }, [JSON.stringify(post.media_ids || post.mediaIds || [])]);

    // 2. Lấy thông tin bài gốc nhúng nếu là bài được chia sẻ (is_shared = true)
    useEffect(() => {
        const fetchOriginalPost = async () => {
            if (post.is_shared && (post.original_post_id || post.original_reel_id)) {
                setIsLoadingOriginal(true);
                try {
                    let res;
                    if (post.original_post_id) {
                        res = await api.get(`/posts/${post.original_post_id}`);
                    } else if (post.original_reel_id) {
                        res = await api.get(`/reels/${post.original_reel_id}`);
                    }
                    if (res && res.data && res.data.success) {
                        setOriginalPost(res.data.data);
                    }
                } catch (error) {
                    console.error("❌ Lỗi lấy thông tin bài đăng gốc:", error.message);
                } finally {
                    setIsLoadingOriginal(false);
                }
            }
        };
        fetchOriginalPost();
    }, [post.is_shared, post.original_post_id, post.original_reel_id]);

    // 2b. Tải tất cả Media (Ảnh & Video) của bài viết gốc
    useEffect(() => {
        let createdObjectUrls = [];
        const originalMediaList = originalPost ? (originalPost.media_ids || originalPost.mediaIds || []) : [];
        const fetchOriginalMedia = async () => {
            if (originalMediaList && originalMediaList.length > 0) {
                setIsLoadingOriginalMedia(true);
                try {
                    const promises = originalMediaList.map(async (mId) => {
                        try {
                            const metaRes = await api.get(`/media/${mId}`);
                            const mimeType = metaRes.data?.mimeType || "";
                            const isVideo = mimeType.startsWith("video/");

                            if (isVideo) {
                                return {id: mId, url: "", isVideo: true};
                            } else {
                                const res = await api.get(`/media/file/${mId}?variant=medium`, {responseType: "blob"});
                                const objUrl = URL.createObjectURL(res.data);
                                createdObjectUrls.push(objUrl);
                                return {id: mId, url: objUrl, isVideo: false};
                            }
                        } catch (err) {
                            return null;
                        }
                    });
                    const results = await Promise.all(promises);
                    setOriginalMediaItems(results.filter(Boolean));
                } catch (error) {
                    console.error("❌ Lỗi lấy media bài gốc:", error.message);
                } finally {
                    setIsLoadingOriginalMedia(false);
                }
            } else {
                setOriginalMediaItems([]);
                setIsLoadingOriginalMedia(false);
            }
        };
        fetchOriginalMedia();

        return () => {
            createdObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [originalPost]);

    // 3. Tải danh sách bình luận khi mở khung accordion
    useEffect(() => {
        if (showComments) {
            const fetchComments = async () => {
                setIsLoadingComments(true);
                try {
                    const res = await api.get(`/posts/${post.id}/comments`);
                    if (res.data && res.data.success) {
                        setComments(res.data.data || []);
                    }
                } catch (error) {
                    console.error("❌ Lỗi lấy danh sách bình luận:", error.message);
                } finally {
                    setIsLoadingComments(false);
                }
            };
            fetchComments();
        }
    }, [showComments, post.id]);

    // 4. Tải danh sách người đã thả cảm xúc (Reactors)
    const fetchReactors = async () => {
        if (isLoadingReactors) return;
        setIsLoadingReactors(true);
        try {
            const res = await api.get(`/posts/${post.id}/likes`);
            if (res.data && res.data.success) {
                setReactorsList(res.data.data || []);
            }
        } catch (error) {
            console.error("❌ Lỗi lấy danh sách người thả cảm xúc:", error);
        } finally {
            setIsLoadingReactors(false);
        }
    };

    // Xử lý hover vào nút Thích / số lượt thích để hiện danh sách người tương tác
    const handleMouseEnterReactors = () => {
        clearTimeout(reactorsTimer.current);
        reactorsTimer.current = setTimeout(() => {
            setShowReactorsPopover(true);
            fetchReactors();
        }, 300);
    };

    const handleMouseLeaveReactors = () => {
        clearTimeout(reactorsTimer.current);
        reactorsTimer.current = setTimeout(() => {
            setShowReactorsPopover(false);
        }, 300);
    };

    // Xử lý hover vào nút Thích để hiện thanh Reaction Emojis kiểu Facebook
    const handleMouseEnterLike = () => {
        clearTimeout(reactionPickerTimer.current);
        reactionPickerTimer.current = setTimeout(() => {
            setShowReactionPicker(true);
        }, 350);
        handleMouseEnterReactors();
    };

    const handleMouseLeaveLike = () => {
        clearTimeout(reactionPickerTimer.current);
        reactionPickerTimer.current = setTimeout(() => {
            setShowReactionPicker(false);
        }, 400);
        handleMouseLeaveReactors();
    };

    // Thích / Bỏ thích cơ bản khi click nút Like
    const handleLike = async () => {
        try {
            if (isLiked) {
                const res = await api.delete(`/posts/${post.id}/like`);
                if (res.data && res.data.success) {
                    setIsLiked(false);
                    setSelectedReaction(null);
                    setLikeCount(prev => Math.max(0, prev - 1));
                }
            } else {
                const res = await api.post(`/posts/${post.id}/like`);
                if (res.data && res.data.success) {
                    setIsLiked(true);
                    setSelectedReaction(REACTION_OPTIONS[0]);
                    setLikeCount(prev => prev + 1);
                }
            }
        } catch (error) {
            console.error("❌ Lỗi thả cảm xúc bài viết:", error);
        }
    };

    // Chọn cảm xúc cụ thể (Thích, Yêu thích, Haha, Wow, Buồn, Phẫn nộ)
    const handleSelectReaction = async (reaction) => {
        setShowReactionPicker(false);
        try {
            if (!isLiked) {
                const res = await api.post(`/posts/${post.id}/like`);
                if (res.data && res.data.success) {
                    setIsLiked(true);
                    setSelectedReaction(reaction);
                    setLikeCount(prev => prev + 1);
                }
            } else {
                setSelectedReaction(reaction);
            }
        } catch (error) {
            console.error("❌ Lỗi thả cảm xúc:", error);
        }
    };

    // 5. Gửi bình luận mới
    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        let finalContent = commentText.trim();
        if (replyingTo) {
            const replyAuthor = replyingTo.author;
            const parentId = replyingTo.id || replyingTo._id;
            // Nếu phản hồi chính mình (cùng ID hoặc cùng tên hiển thị)
            if (replyingTo.author_id === currentUserId || replyAuthor?.id === currentUserId || replyAuthor?.displayName === currentUser?.displayName) {
                finalContent = `[reply:${parentId}] ${commentText.trim()}`;
            } else {
                finalContent = `[reply:${parentId}:@${replyAuthor?.displayName || "Người dùng"}] ${commentText.trim()}`;
            }
        }

        setIsSubmittingComment(true);
        try {
            const res = await api.post(`/posts/${post.id}/comments`, {
                content: finalContent
            });

            if (res.data && res.data.success) {
                // Thêm trực tiếp vào danh sách bình luận hiển thị
                setComments(prev => [...prev, res.data.data]);
                setCommentText("");
                setReplyingTo(null); // Reset trạng thái phản hồi
                setCommentCount(prev => prev + 1);
            }
        } catch (error) {
        } finally {
            setIsSubmittingComment(false);
        }
    };

    // 6. Xóa bình luận
    const handleDeleteComment = async (commentId) => {
        const isConfirmed = await confirm({
            title: "Xóa bình luận",
            message: "Bạn có chắc chắn muốn xóa bình luận này không?",
            confirmText: "Xóa ngay",
            type: "danger"
        });
        if (!isConfirmed) return;

        try {
            const res = await api.delete(`/posts/${post.id}/comments/${commentId}`);
            if (res.data && res.data.success) {
                setComments(prev => prev.filter(c => c.id !== commentId && c._id !== commentId));
                setCommentCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {}
    };

    // 7. Xử lý chia sẻ thành công từ ShareModal
    const handleShareSuccess = (newPost) => {
        setShareCount(prev => prev + 1);
        if (onPostShared) {
            onPostShared(newPost); // Thêm bài chia sẻ lên đầu Feed
        }
    };

    // 8. Xóa bài viết cá nhân
    const handleDeletePost = async () => {
        const isConfirmed = await confirm({
            title: "Xóa bài viết",
            message: "Bạn có chắc chắn muốn xóa bài viết này khỏi hệ thống không? Thao tác này không thể hoàn tác.",
            confirmText: "Xóa bài viết",
            type: "danger"
        });
        if (!isConfirmed) return;
        try {
            const res = await api.delete(`/posts/${post.id}`);
            if (res.data && res.data.success) {
                if (onPostDeleted) {
                    onPostDeleted(post.id);
                }
            }
        } catch (error) {}
    };

    // 9. Nhận phản hồi cập nhật từ EditPostModal
    const handlePostUpdated = (updatedPost) => {
        const mergedPost = {
            ...updatedPost,
            author: post.author,
            isLikedByMe: isLiked,
            like_count: likeCount,
            comment_count: commentCount,
            share_count: shareCount
        };
        if (onPostUpdated) {
            onPostUpdated(mergedPost);
        }
    };

    const authorProfilePath = post.group_id 
        ? `/groups/${post.group_id}/user/${post.author_id}` 
        : `/profile/${post.author_id}`;

    return (
        <article className="bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-[0px_10px_40px_rgba(142,148,242,0.06)] dark:shadow-[0px_10px_40px_rgba(0,0,0,0.3)] border border-outline-variant/10 transition-transform duration-500 hover:-translate-y-1 mb-6">
            {/* Header: Thông tin tác giả */}
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link to={authorProfilePath} className="block group">
                        <img
                            src={post.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                            alt="Author Avatar"
                            className="w-12 h-12 rounded-full border border-outline-variant/20 object-cover ring-2 ring-primary-fixed/50 group-hover:opacity-85 transition"
                        />
                    </Link>
                    <div>
                        <div className="flex items-center flex-wrap gap-2">
                            <Link to={authorProfilePath} className="font-headline-md text-[18px] text-on-surface hover:text-primary transition">
                                {post.author?.displayName || "Người dùng SocialHub"}
                            </Link>
                            {!hideGroupBadge && post.group && (
                                <div className="inline-flex items-center gap-1.5 text-xs">
                                    <span className="text-on-surface-variant font-medium">đăng trong</span>
                                    <Link 
                                        to={`/groups/${post.group.id}`} 
                                        className="font-semibold text-on-surface hover:text-primary transition inline-flex items-center gap-1 bg-surface-container-high/60 px-2.5 py-1 rounded-full border border-outline-variant/10"
                                    >
                                        <MaterialIcon name="groups" size={14} className="text-primary" />
                                        <span>{post.group.name}</span>
                                        {post.group.privacy === 'private' ? (
                                            <MaterialIcon name="lock" size={12} className="text-on-surface-variant" title="Nhóm riêng tư" />
                                        ) : (
                                            <MaterialIcon name="public" size={12} className="text-on-surface-variant" title="Nhóm công khai" />
                                        )}
                                    </Link>
                                </div>
                            )}
                        </div>
                        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mt-0.5">{formatRelativeTime(post.created_at || post.createdAt)}</p>
                    </div>
                </div>

                {/* Nút ... Dropdown Tùy chọn Bài đăng */}
                <div ref={postMenuRef} className="relative ml-auto shrink-0">
                    <button
                        type="button"
                        onClick={() => setShowPostMenu(!showPostMenu)}
                        className="p-2 text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-high/60 rounded-xl transition cursor-pointer"
                        title="Tùy chọn bài đăng"
                    >
                        <MaterialIcon name="more_horiz" size={20} />
                    </button>

                    {showPostMenu && (
                        <div className="absolute right-0 top-9 z-50 w-48 bg-surface-container-high/95 dark:bg-surface-container-high backdrop-blur-md border border-outline-variant/20 rounded-2xl shadow-xl py-1.5 text-sm text-on-surface animate-fade-in">
                            {/* Nút Tắt/Bật bình luận (Tác giả hoặc Admin nhóm) */}
                            {(post.author_id === currentUserId || post.author_id === currentUser?.id || post.isGroupAdmin || post.currentUserRole === 'admin' || post.currentUserRole === 'moderator') && (
                                <button
                                    type="button"
                                    onClick={handleToggleComments}
                                    className="w-full text-left px-4 py-2 hover:bg-surface-container-highest/60 flex items-center gap-3 transition cursor-pointer"
                                >
                                    <MaterialIcon name={commentsDisabled ? "comment" : "comments_disabled"} size={16} className="text-on-surface-variant" />
                                    <span>{commentsDisabled ? "Mở lại bình luận" : "Tắt bình luận"}</span>
                                </button>
                            )}

                            {/* Chỉnh sửa (chỉ tác giả) */}
                            {(post.author_id === currentUserId || post.author_id === currentUser?.id) && (
                                <button
                                    type="button"
                                    onClick={() => { setShowPostMenu(false); setShowEditModal(true); }}
                                    className="w-full text-left px-4 py-2 hover:bg-surface-container-highest/60 flex items-center gap-3 transition cursor-pointer"
                                >
                                    <MaterialIcon name="edit" size={16} className="text-on-surface-variant" />
                                    <span>Chỉnh sửa bài viết</span>
                                </button>
                            )}

                            {/* Xóa bài viết (Tác giả hoặc Admin/Moderator nhóm) */}
                            {(post.author_id === currentUserId || post.author_id === currentUser?.id || post.isGroupAdmin || post.currentUserRole === 'admin' || post.currentUserRole === 'moderator') && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => { setShowPostMenu(false); handleDeletePost(); }}
                                        className="w-full text-left px-4 py-2 hover:bg-error-container/30 text-error flex items-center gap-3 transition cursor-pointer"
                                    >
                                        <MaterialIcon name="delete" size={16} />
                                        <span>Xóa bài viết</span>
                                    </button>
                                    <div className="border-t border-outline-variant/10 my-1" />
                                </>
                            )}
                            {/* Ai cũng thấy Báo cáo (trừ tác giả) */}
                            {(post.author_id !== currentUserId && post.author_id !== currentUser?.id) && (
                                <button
                                    type="button"
                                    onClick={() => { setShowPostMenu(false); }}
                                    className="w-full text-left px-4 py-2 hover:bg-surface-container-highest/60 text-error flex items-center gap-3 transition cursor-pointer"
                                >
                                    <MaterialIcon name="flag" size={16} />
                                    <span>Báo cáo bài viết</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => { setShowPostMenu(false); navigator.clipboard?.writeText(window.location.origin + `/posts/${post.id}`); }}
                                className="w-full text-left px-4 py-2 hover:bg-surface-container-highest/60 flex items-center gap-3 transition cursor-pointer"
                            >
                                <MaterialIcon name="link" size={16} className="text-on-surface-variant" />
                                <span>Sao chép liên kết</span>
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Nội dung chữ */}
            <p className="font-body-lg text-body-lg text-on-surface mb-6 leading-relaxed whitespace-pre-wrap">{post.content}</p>

            {/* Khung hiển thị đa phương tiện (Ảnh & Video Grid) */}
            {mediaItems.length > 0 && (
                <div className={`grid gap-2 rounded-2xl overflow-hidden border border-slate-200 mb-4 bg-slate-50 ${mediaItems.length === 1 ? "grid-cols-1" : "grid-cols-2"
                    }`}>
                    {mediaItems.map((item, idx) => (
                        <div key={item.id} className="relative overflow-hidden flex items-center justify-center bg-black/5 rounded-xl">
                            {item.isVideo ? (
                                <HlsVideoPlayer mediaId={item.id} controls autoPlay={false} className="w-full max-h-[450px] object-cover rounded-xl" />
                            ) : (
                                <img
                                    src={item.url}
                                    alt="Post Attachment"
                                    className="w-full max-h-[450px] object-cover hover:opacity-95 transition cursor-pointer"
                                    onClick={() => handleOpenLightbox(idx, mediaItems)}
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}
            {isLoadingMedia && (
                <div className="h-48 bg-slate-50 animate-pulse rounded-xl flex items-center justify-center text-slate-400 mb-4">
                    Đang tải đa phương tiện...
                </div>
            )}

            {/* Nếu là bài chia sẻ, hiển thị bài gốc nhúng lồng bên trong (Nested Card) */}
            {post.is_shared && (post.original_post_id || post.original_reel_id) && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 mb-4 space-y-3 hover:border-blue-500/30 transition">
                    {isLoadingOriginal ? (
                        <div className="flex justify-center py-4">
                            <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                        </div>
                    ) : originalPost ? (
                        <>
                            {/* Header bài gốc - Click để dẫn về trang cá nhân của tác giả gốc */}
                            <div className="flex items-center space-x-2.5">
                                <Link to={`/profile/${originalPost.author_id}`} className="block group">
                                    <img
                                        src={originalPost.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                        className="w-7 h-7 rounded-full border border-slate-200 object-cover group-hover:opacity-85 transition"
                                        alt="Original Author"
                                    />
                                </Link>
                                <div>
                                    <Link to={`/profile/${originalPost.author_id}`} className="font-semibold text-slate-800 text-xs hover:text-blue-600 transition">
                                        {originalPost.author?.displayName}
                                    </Link>
                                    <p className="text-[10px] text-slate-500 mt-0.5">{formatRelativeTime(originalPost.created_at || originalPost.createdAt)}</p>
                                </div>
                            </div>
                            {/* Nội dung chữ bài gốc */}
                            <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">{originalPost.content}</p>
                            {/* Các tệp Media đính kèm bài gốc */}
                            {originalMediaItems.length > 0 && (
                                <div className={`grid gap-1.5 rounded-xl overflow-hidden border border-slate-200 mt-2 bg-slate-50 max-w-lg ${originalMediaItems.length === 1 ? "grid-cols-1" : "grid-cols-2"
                                    }`}>
                                    {originalMediaItems.map((item, idx) => (
                                        <div key={item.id} className="relative overflow-hidden flex items-center justify-center bg-black/5 rounded-lg max-h-48">
                                            {item.isVideo ? (
                                                <HlsVideoPlayer mediaId={item.id} controls autoPlay={false} className="w-full max-h-48 object-cover rounded-lg" />
                                            ) : (
                                                <img
                                                    src={item.url}
                                                    alt="Original Attachment"
                                                    className="w-full max-h-48 object-cover hover:opacity-95 transition cursor-pointer"
                                                    onClick={() => handleOpenLightbox(idx, originalMediaItems)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {isLoadingOriginalMedia && (
                                <div className="h-24 bg-slate-50 animate-pulse rounded-xl flex items-center justify-center text-[10px] text-slate-400 mt-2">
                                    Đang tải đa phương tiện bài gốc...
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-slate-400 text-xs italic">Bài viết gốc đã bị xóa hoặc không thể truy cập.</p>
                    )}
                </div>
            )}

            {/* Footer tương tác theo discoveryscreen.html */}
            <footer className="flex items-center gap-8 pt-4 border-t border-outline-variant/10">
                {/* Nút Thích & Reaction Bar */}
                <div 
                    className="relative"
                    onMouseEnter={handleMouseEnterLike}
                    onMouseLeave={handleMouseLeaveLike}
                >
                    {/* Bảng Popup danh sách người tương tác */}
                    {showReactorsPopover && (
                        <div 
                            onMouseEnter={() => clearTimeout(reactorsTimer.current)}
                            onMouseLeave={handleMouseLeaveReactors}
                            className="absolute bottom-full mb-3 left-0 w-64 bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/10 rounded-2xl shadow-2xl z-40 p-3 animate-slide-up"
                        >
                            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2 mb-2">
                                <span className="font-bold text-xs text-on-surface flex items-center space-x-1">
                                    <span>❤️👍 Người tương tác</span>
                                    <span className="text-on-surface-variant font-normal">({likeCount})</span>
                                </span>
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                                {isLoadingReactors ? (
                                    <div className="p-4 flex items-center justify-center text-on-surface-variant">
                                        <MaterialIcon name="progress_activity" className="animate-spin text-primary mr-2" size={18} />
                                        <span className="text-xs">Đang tải danh sách...</span>
                                    </div>
                                ) : reactorsList.length === 0 ? (
                                    <p className="text-xs text-on-surface-variant text-center py-3">Chưa có người dùng nào thả cảm xúc.</p>
                                ) : (
                                    reactorsList.map((item) => {
                                        const reactor = item.user || {};
                                        return (
                                            <Link
                                                key={item.id || item.user_id}
                                                to={`/profile/${reactor.id || item.user_id}`}
                                                className="flex items-center space-x-2.5 p-1.5 hover:bg-surface-container-high/60 rounded-xl transition group"
                                            >
                                                <img
                                                    src={reactor.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                    className="w-7 h-7 rounded-full object-cover border border-outline-variant/20 shrink-0"
                                                    alt="Avatar"
                                                />
                                                <span className="text-xs font-semibold text-on-surface group-hover:text-primary truncate flex-1">
                                                    {reactor.displayName || "Người dùng"}
                                                </span>
                                                <span className="text-xs">👍</span>
                                            </Link>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Thanh Reaction Picker Bar */}
                    {showReactionPicker && (
                        <div 
                            onMouseEnter={() => clearTimeout(reactionPickerTimer.current)}
                            onMouseLeave={handleMouseLeaveLike}
                            className="absolute bottom-full mb-2 left-0 bg-surface-container-lowest/95 dark:bg-surface-container-high/95 backdrop-blur-md border border-outline-variant/20 rounded-full shadow-2xl p-1.5 flex items-center space-x-1 z-50 animate-slide-up"
                        >
                            {REACTION_OPTIONS.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelectReaction(item)}
                                    className="p-1.5 text-xl hover:scale-125 transition-all duration-200 cursor-pointer hover:bg-surface-container-high/60 rounded-full relative group"
                                    title={item.label}
                                >
                                    <span>{item.emoji}</span>
                                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] font-medium px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition duration-150 pointer-events-none whitespace-nowrap shadow-md">
                                        {item.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleLike}
                        className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group cursor-pointer"
                    >
                        {isLiked && selectedReaction ? (
                            <span className="text-base leading-none">{selectedReaction.emoji}</span>
                        ) : (
                            <MaterialIcon
                                name="favorite"
                                filled={isLiked}
                                className={`text-[20px] transition-transform group-hover:scale-110 ${isLiked ? "text-error" : ""}`}
                            />
                        )}
                        <span className="font-label-sm text-[11px] uppercase tracking-wider">{likeCount}</span>
                    </button>
                </div>

                {/* Nút Bình luận */}
                <button
                    onClick={() => setShowComments(!showComments)}
                    className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group cursor-pointer"
                >
                    <MaterialIcon name="chat_bubble" size={20} className="transition-transform group-hover:scale-110" />
                    <span className="font-label-sm text-[11px] uppercase tracking-wider">{commentCount}</span>
                </button>

                {/* Nút Chia sẻ */}
                <button
                    onClick={() => setShowShareModal(true)}
                    className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors group ml-auto cursor-pointer"
                >
                    <MaterialIcon name="share" size={20} className="transition-transform group-hover:scale-110" />
                    <span className="font-label-sm text-[11px] uppercase tracking-wider">{shareCount}</span>
                </button>
            </footer>

            {/* BẢNG BÌNH LUẬN ACCORDION */}
            {showComments && (
                <div className="mt-4 pt-4 border-t border-outline-variant/10 space-y-4 animate-fade-in">
                    {/* Banner hiển thị đang phản hồi ai */}
                    {replyingTo && (
                        <div className="flex items-center justify-between bg-primary-container/20 border border-outline-variant/10 rounded-xl px-4 py-1.5 text-[10px] text-primary">
                            <span>Đang Phản hồi <strong>{replyingTo.author?.displayName}</strong></span>
                            <button
                                type="button"
                                onClick={() => setReplyingTo(null)}
                                className="text-on-surface-variant hover:text-error font-bold transition ml-2 cursor-pointer"
                            >
                                Hủy
                            </button>
                        </div>
                    )}

                    {/* Ô nhập bình luận hoặc Banner thông báo bị tắt */}
                    {commentsDisabled ? (
                        <div className="bg-surface-container-high/60 border border-outline-variant/10 px-4 py-3 rounded-2xl text-center text-xs font-semibold text-on-surface-variant flex items-center justify-center space-x-2 my-2">
                            <MaterialIcon name="comments_disabled" size={18} className="text-on-surface-variant/70" />
                            <span>Tính năng bình luận đã bị tắt cho bài viết này</span>
                        </div>
                    ) : (
                        <form onSubmit={handleAddComment} className="flex items-center space-x-3">
                            <input
                                ref={commentInputRef}
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder={replyingTo ? `Phản hồi ${replyingTo.author?.displayName}...` : "Viết bình luận..."}
                                className="flex-1 bg-surface-container-low/60 border border-outline-variant/10 rounded-xl px-4 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition"
                            />
                            <button
                                type="submit"
                                disabled={isSubmittingComment || !commentText.trim()}
                                className="p-2 bg-primary disabled:opacity-50 hover:bg-primary/90 text-on-primary rounded-xl cursor-pointer transition flex items-center justify-center"
                            >
                                {isSubmittingComment ? (
                                    <MaterialIcon name="progress_activity" size={16} className="animate-spin" />
                                ) : (
                                    <MaterialIcon name="send" size={16} />
                                )}
                            </button>
                        </form>
                    )}

                    {/* Danh sách bình luận */}
                    {isLoadingComments ? (
                        <div className="flex justify-center py-4">
                            <MaterialIcon name="progress_activity" size={24} className="text-primary animate-spin" />
                        </div>
                    ) : comments.length > 0 ? (
                        <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                            {(() => {
                                const {parents, repliesByParent} = getStructuredComments();

                                return parents.map((parentComment) => {
                                    const parentId = parentComment.id || parentComment._id;
                                    const myUserId = currentUserId || currentUser?.id;
                                    const commentAuthorId = parentComment.author_id || parentComment.author?.id || parentComment.authorId;
                                    const postAuthorId = post.author_id || post.author?.id || post.authorId;

                                    const isParentAuthor = Boolean(myUserId && (commentAuthorId === myUserId || parentComment.author?.id === myUserId));
                                    const isPostAuthor = Boolean(myUserId && (postAuthorId === myUserId || post.author?.id === myUserId));
                                    const parentReplies = repliesByParent[parentId] || [];

                                    return (
                                        <div key={parentId} className="space-y-2">
                                            {/* Bình luận gốc */}
                                            <div className="flex items-start justify-between bg-surface-container-low/40 rounded-2xl p-3 border border-outline-variant/10 group transition-all duration-200 relative">
                                                <div className="flex items-start space-x-3 flex-1 min-w-0 pr-2">
                                                    <img
                                                        src={parentComment.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                        className="w-8 h-8 rounded-full border border-outline-variant/20 object-cover shrink-0"
                                                        alt="Commenter Avatar"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="font-bold text-on-surface text-xs">{parentComment.author?.displayName}</span>
                                                            <span className="text-[10px] text-on-surface-variant">{formatRelativeTime(parentComment.created_at || parentComment.createdAt)}</span>
                                                        </div>

                                                        {editingCommentId === parentId ? (
                                                            <form onSubmit={(e) => { e.preventDefault(); handleSaveEditComment(parentId, parentComment.parsedInfo?.mentionName ? `[reply:${parentComment.parsedInfo.parentId || ""}:@${parentComment.parsedInfo.mentionName}]` : ""); }} className="mt-1 flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={editingCommentText}
                                                                    onChange={(e) => setEditingCommentText(e.target.value)}
                                                                    className="flex-1 bg-surface-container/80 border border-primary/40 rounded-lg px-2.5 py-1 text-xs text-on-surface focus:outline-none"
                                                                    autoFocus
                                                                />
                                                                <button type="submit" className="text-xs font-semibold text-primary hover:underline">Lưu</button>
                                                                <button type="button" onClick={() => setEditingCommentId(null)} className="text-xs text-on-surface-variant hover:underline">Hủy</button>
                                                            </form>
                                                        ) : (
                                                            <p className="text-on-surface-variant text-xs mt-1 leading-relaxed whitespace-pre-wrap">
                                                                {parentComment.parsedInfo?.mentionName ? (
                                                                    <span>
                                                                        <span className="text-primary font-semibold cursor-pointer hover:underline mr-1.5">
                                                                            @{parentComment.parsedInfo.mentionName}
                                                                        </span>
                                                                        {parentComment.parsedInfo.cleanText}
                                                                    </span>
                                                                ) : (
                                                                    parentComment.parsedInfo?.cleanText || parentComment.content
                                                                )}
                                                            </p>
                                                        )}

                                                        {/* Nút Phản hồi */}
                                                        <button
                                                            onClick={() => handleReplyClick(parentComment)}
                                                            className="text-[10px] text-on-surface-variant hover:text-primary font-semibold mt-1 transition cursor-pointer"
                                                        >
                                                            Phản hồi
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Nút Dấu 3 chấm (...) Dropdown Tùy chọn Bình luận */}
                                                <div className="relative shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveCommentMenu(activeCommentMenu === parentId ? null : parentId)}
                                                        className="p-1 text-on-surface-variant/60 hover:text-on-surface rounded-lg hover:bg-surface-container-high/60 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                                                        title="Tùy chọn bình luận"
                                                    >
                                                        <MaterialIcon name="more_horiz" size={16} />
                                                    </button>

                                                    {activeCommentMenu === parentId && (
                                                        <div className="absolute right-0 top-6 z-50 w-36 bg-surface-container-high/95 dark:bg-surface-container-high backdrop-blur-md border border-outline-variant/20 rounded-xl shadow-xl py-1 text-xs text-on-surface animate-fade-in">
                                                            {isParentAuthor && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartEditComment(parentComment)}
                                                                    className="w-full text-left px-3 py-1.5 hover:bg-surface-container-highest/60 flex items-center space-x-2 transition cursor-pointer"
                                                                >
                                                                    <MaterialIcon name="edit" size={14} />
                                                                    <span>Chỉnh sửa</span>
                                                                </button>
                                                            )}
                                                            {(isParentAuthor || isPostAuthor) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setActiveCommentMenu(null); handleDeleteComment(parentId); }}
                                                                    className="w-full text-left px-3 py-1.5 hover:bg-error-container/30 text-error flex items-center space-x-2 transition cursor-pointer"
                                                                >
                                                                    <MaterialIcon name="delete" size={14} />
                                                                    <span>Xóa bình luận</span>
                                                                </button>
                                                            )}
                                                            {!isParentAuthor && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleReportComment(parentId)}
                                                                    className="w-full text-left px-3 py-1.5 hover:bg-surface-container-highest/60 text-error flex items-center space-x-2 transition cursor-pointer"
                                                                >
                                                                    <MaterialIcon name="flag" size={14} />
                                                                    <span>Báo cáo</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Danh sách các phản hồi lồng dưới */}
                                            {parentReplies.map((reply) => {
                                                const rId = reply.id || reply._id;
                                                const replyAuthorId = reply.author_id || reply.author?.id || reply.authorId;
                                                const isReplyAuthor = Boolean(myUserId && (replyAuthorId === myUserId || reply.author?.id === myUserId));

                                                return (
                                                    <div key={rId} className="flex items-start justify-between bg-primary-container/10 rounded-2xl p-3 border border-outline-variant/10 ml-8 group transition-all duration-200 relative">
                                                        <div className="flex items-start space-x-3 flex-1 min-w-0 pr-2">
                                                            <img
                                                                src={reply.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                                className="w-8 h-8 rounded-full border border-outline-variant/20 object-cover shrink-0"
                                                                alt="Commenter Avatar"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="font-bold text-on-surface text-xs">{reply.author?.displayName}</span>
                                                                    <span className="text-[10px] text-on-surface-variant">{formatRelativeTime(reply.created_at || reply.createdAt)}</span>
                                                                </div>

                                                                {editingCommentId === rId ? (
                                                                    <form onSubmit={(e) => { e.preventDefault(); handleSaveEditComment(rId, reply.parsedInfo?.mentionName ? `[reply:${parentId}:@${reply.parsedInfo.mentionName}]` : `[reply:${parentId}]`); }} className="mt-1 flex items-center gap-2">
                                                                        <input
                                                                            type="text"
                                                                            value={editingCommentText}
                                                                            onChange={(e) => setEditingCommentText(e.target.value)}
                                                                            className="flex-1 bg-surface-container/80 border border-primary/40 rounded-lg px-2.5 py-1 text-xs text-on-surface focus:outline-none"
                                                                            autoFocus
                                                                        />
                                                                        <button type="submit" className="text-xs font-semibold text-primary hover:underline">Lưu</button>
                                                                        <button type="button" onClick={() => setEditingCommentId(null)} className="text-xs text-on-surface-variant hover:underline">Hủy</button>
                                                                    </form>
                                                                ) : (
                                                                    <p className="text-on-surface-variant text-xs mt-1 leading-relaxed whitespace-pre-wrap">
                                                                        {reply.parsedInfo?.mentionName ? (
                                                                            <span>
                                                                                <span className="text-primary font-semibold cursor-pointer hover:underline mr-1.5">
                                                                                    @{reply.parsedInfo.mentionName}
                                                                                </span>
                                                                                {reply.parsedInfo.cleanText}
                                                                            </span>
                                                                        ) : (
                                                                            reply.parsedInfo?.cleanText || reply.content
                                                                        )}
                                                                    </p>
                                                                )}

                                                                <button
                                                                    onClick={() => handleReplyClick(parentComment)}
                                                                    className="text-[10px] text-on-surface-variant hover:text-primary font-semibold mt-1 transition cursor-pointer"
                                                                >
                                                                    Phản hồi
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Nút Dấu 3 chấm (...) Dropdown Tùy chọn Bình luận con */}
                                                        <div className="relative shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveCommentMenu(activeCommentMenu === rId ? null : rId)}
                                                                className="p-1 text-on-surface-variant/60 hover:text-on-surface rounded-lg hover:bg-surface-container-high/60 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                                                                title="Tùy chọn bình luận"
                                                            >
                                                                <MaterialIcon name="more_horiz" size={16} />
                                                            </button>

                                                            {activeCommentMenu === rId && (
                                                                <div className="absolute right-0 top-6 z-50 w-36 bg-surface-container-high/95 dark:bg-surface-container-high backdrop-blur-md border border-outline-variant/20 rounded-xl shadow-xl py-1 text-xs text-on-surface animate-fade-in">
                                                                    {isReplyAuthor && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleStartEditComment(reply)}
                                                                            className="w-full text-left px-3 py-1.5 hover:bg-surface-container-highest/60 flex items-center space-x-2 transition cursor-pointer"
                                                                        >
                                                                            <MaterialIcon name="edit" size={14} />
                                                                            <span>Chỉnh sửa</span>
                                                                        </button>
                                                                    )}
                                                                    {(isReplyAuthor || isPostAuthor) && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { setActiveCommentMenu(null); handleDeleteComment(rId); }}
                                                                            className="w-full text-left px-3 py-1.5 hover:bg-error-container/30 text-error flex items-center space-x-2 transition cursor-pointer"
                                                                        >
                                                                            <MaterialIcon name="delete" size={14} />
                                                                            <span>Xóa bình luận</span>
                                                                        </button>
                                                                    )}
                                                                    {!isReplyAuthor && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleReportComment(rId)}
                                                                            className="w-full text-left px-3 py-1.5 hover:bg-surface-container-highest/60 text-error flex items-center space-x-2 transition cursor-pointer"
                                                                        >
                                                                            <MaterialIcon name="flag" size={14} />
                                                                            <span>Báo cáo</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    ) : (
                        <p className="text-center text-on-surface-variant/60 text-xs py-4">Chưa có bình luận nào. Hãy gửi lời bình luận đầu tiên!</p>
                    )}
                </div>
            )}

            {/* POP-UP MODAL CHIA SẺ BÀI VIẾT */}
            {showShareModal && (
                <ShareModal
                    post={post}
                    onClose={() => setShowShareModal(false)}
                    onShareSuccess={handleShareSuccess}
                />
            )}

            {/* POP-UP MODAL CHỈNH SỬA BÀI VIẾT */}
            {showEditModal && (
                <EditPostModal
                    post={post}
                    imageUrl={imageUrl}
                    onClose={() => setShowEditModal(false)}
                    onPostUpdated={handlePostUpdated}
                />
            )}

            {/* POP-UP MODAL XEM ẢNH FULLSCREEN */}
            {lightboxData && (
                <ImageLightboxModal
                    images={lightboxData.items}
                    initialIndex={lightboxData.index}
                    onClose={() => setLightboxData(null)}
                />
            )}
        </article>
    );
};

export default PostCard;
