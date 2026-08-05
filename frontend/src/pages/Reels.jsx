import {useState, useEffect, useRef} from "react";
import {useSearchParams} from "react-router-dom";
import {useAuth} from "../context/AuthContext";
import {useConfirm} from "../context/ConfirmContext";
import api from "../services/api";
import MaterialIcon from "../components/MaterialIcon";
import CreateReelModal from "../components/CreateReelModal";
import ShareModal from "../components/ShareModal";
import HlsVideoPlayer from "../components/HlsVideoPlayer";

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Component con hiển thị từng Video Reel đơn lẻ
const ReelItem = ({reel, isActive, isMuted, toggleMute, onLikeToggle, onOpenComments, onShare, onDelete, currentUserId}) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const isOwner = currentUserId && (reel.author_id === currentUserId || reel.author?.id === currentUserId);

  // Click vào video để Play/Pause thủ công
  const handleVideoClick = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  // Tua video khi click/kéo trên thanh progress bar
  const handleSeek = (e) => {
    e.stopPropagation();
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const targetRatio = Math.max(0, Math.min(1, clickX / width));
    const newTime = targetRatio * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Double Click để Thả tim nhanh giống Instagram
  const handleDoubleClick = () => {
    setShowHeartAnimation(true);
    setTimeout(() => setShowHeartAnimation(false), 800);
    if (!reel.isLikedByMe) {
      onLikeToggle(reel.id);
    }
  };

  const likeCount = reel.like_count ?? reel.likeCount ?? 0;
  const commentCount = reel.comment_count ?? reel.commentCount ?? 0;
  const shareCount = reel.share_count ?? reel.shareCount ?? 0;
  const viewCount = reel.view_count ?? reel.viewCount ?? 0;

  return (
    <div className="w-full h-full snap-start flex justify-center items-center bg-slate-950 relative border-b border-white/5 overflow-hidden">
      {/* Video Phát chính bằng HLS Streaming */}
      {reel.media_ids?.[0] ? (
        <HlsVideoPlayer
          mediaId={reel.media_ids[0]}
          isReel={true}
          isActive={isActive}
          muted={isMuted}
          controls={false}
          videoRefProp={videoRef}
          className="w-full h-full max-w-[450px] cursor-pointer"
          onClick={handleVideoClick}
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
          onPlaySuccess={() => {
            setIsPlaying(true);
            api.post(`/reels/${reel.id}/view`).catch(() => { });
          }}
          onPlayError={() => setIsPlaying(false)}
        />
      ) : (
        <div className="text-slate-500 text-xs italic">Không tải được tệp video</div>
      )}

      {/* Hiệu ứng Trái tim đập khi Double Click */}
      {showHeartAnimation && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 animate-ping">
          <MaterialIcon name="favorite" filled className="text-error text-[96px] opacity-90 animate-bounce" />
        </div>
      )}

      {/* Nút Play hiển thị chính giữa khi tạm dừng video */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-20 h-20 rounded-full bg-surface-container-low/30 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-2xl scale-100 transition duration-200">
            <MaterialIcon name="play_arrow" filled className="text-white text-[40px]" />
          </div>
        </div>
      )}

      {/* Chỉ báo cuộn lên/xuống */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 bg-surface-container-low/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white/90 text-[10px] z-30 pointer-events-none animate-bounce shadow-md">
        <MaterialIcon name="expand_more" className="text-primary-container animate-pulse" size={16} />
        <span>Vuốt để xem Reels tiếp</span>
      </div>

      {/* Nút bật/tắt tiếng âm thanh */}
      <button
        onClick={toggleMute}
        className="absolute top-3 right-3 p-2.5 rounded-full bg-surface-container-low/30 backdrop-blur-md hover:bg-surface-container-low/50 border border-white/10 text-white cursor-pointer z-30 transition duration-150 active:scale-95"
      >
        <MaterialIcon name={isMuted ? "volume_off" : "volume_up"} size={18} />
      </button>

      {/* Phần thông tin tác giả và mô tả */}
      <div className="absolute bottom-8 left-4 right-20 text-left space-y-2 z-30 max-w-[78%] sm:max-w-[80%] pointer-events-auto break-words text-white">
        <div className="flex items-center space-x-3 mb-2">
          <img
            src={reel.author?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${reel.author_id}`}
            className="w-10 h-10 rounded-full object-cover border-2 border-white/30 shadow-md shrink-0"
            alt="Author Avatar"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-headline-md text-[18px] font-semibold leading-tight text-white drop-shadow-md truncate">{reel.author?.displayName || "Người dùng"}</h3>
            <p className="font-label-sm text-xs opacity-80 text-white/90">{viewCount} lượt xem</p>
          </div>
        </div>
        {reel.content && (
          <p className="font-body-md text-sm leading-relaxed line-clamp-3 text-white/90 drop-shadow-sm select-text break-words">
            {reel.content}
          </p>
        )}
      </div>

      {/* Cột các nút tương tác bên phải */}
      <div className="absolute bottom-12 right-6 flex flex-col gap-6 z-30 items-center pointer-events-auto">
        {/* Nút Like */}
        <button onClick={() => onLikeToggle(reel.id)} className="flex flex-col items-center gap-1 group/btn cursor-pointer">
          <div className={`w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center border transition-all duration-300 group-hover/btn:scale-110 ${
            reel.isLikedByMe
              ? "bg-error-container/60 border-error text-error"
              : "bg-surface-container-low/20 border-white/10 text-white group-hover/btn:bg-error-container/40"
          }`}>
            <MaterialIcon name="favorite" filled={reel.isLikedByMe} className="text-white group-hover/btn:text-error transition-colors" size={22} />
          </div>
          <span className="font-label-sm text-xs text-white/90 drop-shadow-md">{likeCount}</span>
        </button>

        {/* Nút Bình luận */}
        <button onClick={() => onOpenComments(reel)} className="flex flex-col items-center gap-1 group/btn cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-surface-container-low/20 backdrop-blur-xl flex items-center justify-center border border-white/10 text-white transition-all duration-300 group-hover/btn:scale-110 group-hover/btn:bg-primary-container/40">
            <MaterialIcon name="chat_bubble" size={22} className="text-white transition-colors" />
          </div>
          <span className="font-label-sm text-xs text-white/90 drop-shadow-md">{commentCount}</span>
        </button>

        {/* Nút Chia sẻ */}
        <button onClick={() => onShare(reel)} className="flex flex-col items-center gap-1 group/btn cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-surface-container-low/20 backdrop-blur-xl flex items-center justify-center border border-white/10 text-white transition-all duration-300 group-hover/btn:scale-110 group-hover/btn:bg-secondary-container/40">
            <MaterialIcon name="share" size={22} className="text-white transition-colors" />
          </div>
          <span className="font-label-sm text-xs text-white/90 drop-shadow-md">{shareCount}</span>
        </button>

        {/* Nút Xóa Reel */}
        {isOwner && (
          <button onClick={() => onDelete(reel.id)} title="Xóa thước phim" className="flex flex-col items-center gap-1 group/btn cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-surface-container-low/20 backdrop-blur-xl flex items-center justify-center border border-white/10 text-white transition-all duration-300 group-hover/btn:scale-110 group-hover/btn:bg-error/40">
              <MaterialIcon name="delete" size={22} className="text-white" />
            </div>
            <span className="font-label-sm text-[10px] text-white/80">Xóa</span>
          </button>
        )}
      </div>

      {/* Thanh progress bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-1 pt-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col space-y-1 pointer-events-auto">
        <div
          className="relative w-full h-1.5 hover:h-2.5 bg-white/20 hover:bg-white/30 rounded-full cursor-pointer transition-all duration-150 group"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-primary-container rounded-full relative group-hover:bg-primary"
            style={{width: `${duration ? (currentTime / duration) * 100 : 0}%`}}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex justify-between items-center text-[10px] text-white/70 font-mono px-0.5 pointer-events-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Đáy sẫm màu để text dễ đọc */}
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-0" />
    </div>
  );
};

// Component chính trang Reels
const Reels = () => {
  const {user} = useAuth();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const targetReelId = searchParams.get("id");

  const [reels, setReels] = useState([]);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedSharePost, setSelectedSharePost] = useState(null);

  // Drawer bình luận
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedCommentReel, setSelectedCommentReel] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const containerRef = useRef(null);
  const observerRef = useRef(null);

  // Load danh sách Reels từ Backend
  const fetchReels = async (currentPage) => {
    try {
      // 1. Tải danh sách Reels theo trang
      const res = await api.get(`/reels?page=${currentPage}&limit=5`);
      let list = (res.data && res.data.success) ? (res.data.data || []) : [];

      // 2. Nếu ở Trang 1 và URL có tham số id (Reel được chia sẻ từ tin nhắn)
      if (currentPage === 1 && targetReelId) {
        try {
          const targetRes = await api.get(`/reels/${targetReelId}`);
          if (targetRes.data && targetRes.data.success && targetRes.data.data) {
            const targetReel = targetRes.data.data;
            // Loại bỏ trùng lặp và đưa Reel được chia sẻ lên Vị trí đầu tiên (Index 0)
            list = [targetReel, ...list.filter(r => r.id !== targetReelId)];
          }
        } catch (singleErr) {
          console.warn("⚠️ Không lấy được Reel cụ thể theo ID:", singleErr.message);
        }
      }

      if (list.length === 0) {
        setHasMore(false);
      } else {
        setReels(prev => (currentPage === 1 ? list : [...prev, ...list]));
      }
    } catch (err) {
      console.error("❌ Lỗi tải Reels:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReels(1);
  }, [targetReelId]);

  // Thiết lập IntersectionObserver theo dõi video nào đang hiển thị ở tâm viewport
  useEffect(() => {
    if (reels.length === 0) return;

    const options = {
      root: containerRef.current,
      rootMargin: "0px",
      threshold: 0.6 // Element phải hiển thị ít nhất 60% diện tích
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute("data-index"), 10);
          setActiveReelIndex(index);

          // Phân trang tự động: Nếu cuộn gần tới cuối danh sách, tải thêm Reels
          if (index === reels.length - 2 && hasMore) {
            setPage(prev => {
              const nextPage = prev + 1;
              fetchReels(nextPage);
              return nextPage;
            });
          }
        }
      });
    }, options);

    // Gắn observer cho từng Reel container
    const children = containerRef.current?.children;
    if (children) {
      Array.from(children).forEach(child => {
        observerRef.current.observe(child);
      });
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [reels, hasMore]);

  // Xử lý Thả tim / Bỏ tim Reels
  const handleLikeToggle = async (reelId) => {
    // 1. Tìm reel hiện tại trong state trước khi làm Optimistic Update
    const currentReel = reels.find(r => r.id === reelId);
    if (!currentReel) return;

    const wasLiked = currentReel.isLikedByMe;

    // 2. Cập nhật Optimistic UI cho mượt
    setReels(prev => prev.map(r => {
      if (r.id === reelId) {
        return {
          ...r,
          isLikedByMe: !wasLiked,
          like_count: !wasLiked ? (r.like_count || 0) + 1 : Math.max((r.like_count || 0) - 1, 0)
        };
      }
      return r;
    }));

    try {
      if (wasLiked) {
        // Nếu đã thích -> Gọi Bỏ thích (UNLIKE)
        await api.delete(`/reels/${reelId}/like`);
      } else {
        // Nếu chưa thích -> Gọi Thích (LIKE)
        await api.post(`/reels/${reelId}/like`);
      }
    } catch (err) {
      console.error("❌ Lỗi tương tác Like Reel:", err.message);
      // Revert lại trạng thái cũ nếu API lỗi
      setReels(prev => prev.map(r => {
        if (r.id === reelId) {
          return {
            ...r,
            isLikedByMe: wasLiked,
            like_count: currentReel.like_count
          };
        }
        return r;
      }));
    }
  };

  // Mở ngăn kéo bình luận
  const handleOpenComments = async (reel) => {
    setSelectedCommentReel(reel);
    setCommentDrawerOpen(true);
    setComments([]);

    // Tải danh sách bình luận
    try {
      const res = await api.get(`/reels/${reel.id}/comments`);
      if (res.data && res.data.success) {
        setComments(res.data.data || []);
      }
    } catch (err) {
      console.error("❌ Lỗi tải bình luận:", err.message);
    }
  };

  // Đăng bình luận mới
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentInput.trim() || !selectedCommentReel || isSubmittingComment) return;

    const contentText = commentInput.trim();
    setIsSubmittingComment(true);
    try {
      const res = await api.post(`/reels/${selectedCommentReel.id}/comments`, {
        content: contentText
      });

      if (res.data && res.data.success) {
        const newCommentObj = res.data.data;
        // Đưa comment mới lên đầu danh sách
        setComments(prev => [newCommentObj, ...prev]);
        setCommentInput("");

        // Cập nhật số đếm bình luận ở UI chính & Drawer
        setReels(prev => prev.map(r => {
          if (r.id === selectedCommentReel.id) {
            return {...r, comment_count: (r.comment_count || 0) + 1};
          }
          return r;
        }));
        setSelectedCommentReel(prev => prev ? ({
          ...prev,
          comment_count: (prev.comment_count || 0) + 1
        }) : null);
      }
    } catch (err) {
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Mở modal chia sẻ
  const handleShareClick = (reel) => {
    // Do cấu trúc bài post chia sẻ tái sử dụng PostCard, ta map Reel thành Object Post tương ứng để ShareModal hoạt động
    const mockPost = {
      id: reel.id,
      content: reel.content,
      author: reel.author,
      media_ids: reel.media_ids
    };
    setSelectedSharePost(mockPost);
    setShowShareModal(true);
  };

  // Xóa Reel dành cho chủ sở hữu
  const handleDeleteReel = async (reelId) => {
    const isConfirmed = await confirm({
      title: "Xóa thước phim",
      message: "Bạn có chắc chắn muốn xóa thước phim này? Thao tác này không thể hoàn tác.",
      confirmText: "Xóa thước phim",
      type: "danger"
    });
    if (!isConfirmed) return;

    try {
      const res = await api.delete(`/reels/${reelId}`);
      if (res.data && res.data.success) {
        setReels(prev => prev.filter(r => r.id !== reelId));
        if (selectedCommentReel?.id === reelId) {
          setCommentDrawerOpen(false);
          setSelectedCommentReel(null);
        }
      }
    } catch (err) {}
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative select-none py-2 md:py-0">

      {/* Header bar trên Reels Player */}
      <div className="w-full max-w-[500px] flex justify-between items-center mb-4 px-2 sm:px-0">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <MaterialIcon name="motion_photos_on" className="text-primary" size={28} />
          <span>Thước phim</span>
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-container hover:opacity-90 active:scale-95 text-on-primary font-label-sm text-label-sm rounded-xl shadow-md cursor-pointer transition"
        >
          <MaterialIcon name="add" size={18} />
          <span>Tạo Reels</span>
        </button>
      </div>

      {/* Frame bọc ngoài Reels card (reelsscreen.html design) */}
      <div className="w-full h-[calc(100vh-11rem)] md:max-w-[500px] md:h-[80vh] md:min-h-[600px] md:rounded-[40px] shadow-[0_20px_60px_rgba(142,148,242,0.15)] border border-outline-variant/10 relative bg-surface-container-lowest dark:bg-surface-container-low flex flex-col overflow-hidden group">

        {/* Khung chứa các Video cuộn dọc */}
        <div
          ref={containerRef}
          className="w-full h-full snap-y snap-mandatory overflow-y-scroll scrollbar-none flex flex-col"
        >
          {isLoading && reels.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center text-on-surface-variant space-y-3">
              <MaterialIcon name="progress_activity" className="text-primary animate-spin" size={32} />
              <p className="text-xs">Đang chuẩn bị thước phim...</p>
            </div>
          ) : reels.length > 0 ? (
            reels.map((reel, index) => {
              const isAdjacent = Math.abs(index - activeReelIndex) <= 1;
              return (
                <div
                  key={reel.id}
                  data-index={index}
                  className="w-full h-full shrink-0 snap-start"
                >
                  {isAdjacent ? (
                    <ReelItem
                      reel={reel}
                      isActive={index === activeReelIndex}
                      isMuted={isMuted}
                      toggleMute={() => setIsMuted(prev => !prev)}
                      onLikeToggle={handleLikeToggle}
                      onOpenComments={handleOpenComments}
                      onShare={handleShareClick}
                      onDelete={handleDeleteReel}
                      currentUserId={user?.id}
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-container-low flex flex-col items-center justify-center text-on-surface-variant space-y-2">
                      <MaterialIcon name="progress_activity" className="animate-spin text-outline" size={24} />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-on-surface-variant text-xs italic space-y-4 p-8 text-center">
              <p>Chưa có Reels nào được đăng tải.</p>
              <p>Hãy trở thành người đầu tiên chia sẻ thước phim ngắn của bạn!</p>
            </div>
          )}
        </div>

        {/* Ngăn kéo Bình luận (Comment Drawer) */}
        {commentDrawerOpen && selectedCommentReel && (
          <div className="absolute inset-x-0 bottom-0 h-[65%] bg-surface-container-lowest/95 dark:bg-surface-container-high/95 backdrop-blur-2xl rounded-t-3xl z-50 flex flex-col border-t border-outline-variant/10 shadow-2xl animate-slide-up">

            {/* Header Drawer */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-outline-variant/10">
              <span className="font-headline-md text-sm text-on-surface flex items-center gap-2">
                <MaterialIcon name="chat_bubble" className="text-primary" size={18} />
                <span>Bình luận ({selectedCommentReel.comment_count || 0})</span>
              </span>
              <button
                onClick={() => setCommentDrawerOpen(false)}
                className="p-1 hover:bg-surface-container-high rounded-full text-on-surface-variant hover:text-on-surface transition cursor-pointer"
              >
                <MaterialIcon name="close" size={18} />
              </button>
            </div>

            {/* Danh sách bình luận */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5 select-text">
              {comments.length > 0 ? (
                comments.map((comment, i) => (
                  <div key={comment.id || i} className="flex items-start space-x-3">
                    <img
                      src={comment.author?.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${comment.author_id}`}
                      className="w-8 h-8 rounded-full object-cover border border-outline-variant/20 mt-0.5"
                      alt="Avatar"
                    />
                    <div className="flex-1 bg-surface-container-low/60 border border-outline-variant/10 px-3.5 py-2.5 rounded-2xl text-left">
                      <span className="font-bold text-xs text-primary block mb-0.5">{comment.author?.displayName || "Người dùng"}</span>
                      <p className="text-xs text-on-surface leading-normal whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-on-surface-variant/60 text-xs italic">
                  Chưa có bình luận nào. Hãy bình luận đầu tiên!
                </div>
              )}
            </div>

            {/* Ô gõ bình luận chân Drawer */}
            <form onSubmit={handlePostComment} className="p-4 border-t border-outline-variant/10 flex items-center space-x-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Nói gì đó về thước phim này..."
                disabled={isSubmittingComment}
                className="flex-1 bg-surface-container-low/60 border border-outline-variant/10 rounded-xl px-4 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isSubmittingComment || !commentInput.trim()}
                className="p-2.5 bg-primary disabled:opacity-50 hover:bg-primary/90 text-on-primary rounded-xl cursor-pointer transition active:scale-95 shadow-md flex items-center justify-center"
              >
                {isSubmittingComment ? (
                  <MaterialIcon name="progress_activity" size={16} className="animate-spin" />
                ) : (
                  <MaterialIcon name="send" size={16} />
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Modals hỗ trợ đăng Reels và Chia sẻ */}
      {showCreateModal && (
        <CreateReelModal
          onClose={() => setShowCreateModal(false)}
          onUploadSuccess={() => {
            setShowCreateModal(false);
            setIsLoading(true);
            setPage(1);
            fetchReels(1); // Load lại feed
          }}
        />
      )}

      {showShareModal && selectedSharePost && (
        <ShareModal
          post={selectedSharePost}
          onClose={() => {
            setShowShareModal(false);
            setSelectedSharePost(null);
          }}
          onShareSuccess={() => {
            setShowShareModal(false);
            setSelectedSharePost(null);
            // Cập nhật số lượt share tăng lên 1 trên UI
            setReels(prev => prev.map(r => {
              if (r.id === selectedSharePost.id) {
                return {...r, share_count: (r.share_count || 0) + 1};
              }
              return r;
            }));
          }}
        />
      )}
    </div>
  );
};

export default Reels;
