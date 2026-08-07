import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Eye, Send, Trash2, Sparkles, Loader } from "lucide-react";
import { formatRelativeTime } from "../../utils/dateUtils";
import { getMediaFileUrl } from "../../services/mediaUrl";
import HlsVideoPlayer from "../HlsVideoPlayer";
import api from "../../services/api";
import { useSocket } from "../../context/SocketContext";

const StoryViewer = ({
  storyGroups,
  initialGroupIndex = 0,
  initialStoryIndex = 0,
  currentUserId,
  onClose,
  onStoryDeleted,
}) => {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // State viewers list modal (chỉ dành cho chủ sở hữu story)
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [isLoadingViewers, setIsLoadingViewers] = useState(false);

  // State reply tin nhắn
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replySentSuccess, setReplySentSuccess] = useState(false);

  const { chatSocket, setToast } = useSocket();

  // State floating reaction emojis (phải khai báo trước mọi return sớm)
  const [floatingReactions, setFloatingReactions] = useState([]);

  const currentGroup = storyGroups[groupIndex];
  const currentStory = currentGroup?.stories?.[storyIndex];
  const isOwner = currentGroup?.author?.id === currentUserId;

  // Ghi nhận lượt xem (record view)
  useEffect(() => {
    if (currentStory && currentStory.id) {
      api.post(`/stories/${currentStory.id}/view`).catch((err) => {
        // Safe to ignore if view recording fails
      });
    }
  }, [currentStory?.id]);

  // Reset progress & state khi chuyển sang story mới
  useEffect(() => {
    setProgress(0);
    setShowViewers(false);
    setReplyText("");
    setReplySentSuccess(false);
  }, [groupIndex, storyIndex]);

  // Progress Bar timer (5 giây mỗi story ảnh, video chạy theo độ dài thực tế của video)
  useEffect(() => {
    if (isPaused || showViewers || !currentStory || currentStory.media_type === "video") return;

    const duration = 5000; // 5s
    const interval = 50; // update mỗi 50ms
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          handleNextStory();
          return 100;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [groupIndex, storyIndex, isPaused, showViewers, currentStory]);

  const handleNextStory = () => {
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((prev) => prev + 1);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex((prev) => prev + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  };

  const handlePrevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex((prev) => prev - 1);
    } else if (groupIndex > 0) {
      const prevGroup = storyGroups[groupIndex - 1];
      setGroupIndex((prev) => prev - 1);
      setStoryIndex(prevGroup.stories.length - 1);
    }
  };

  // Tải danh sách người đã xem
  const handleFetchViewers = async () => {
    if (!currentStory || !isOwner) return;
    setIsPaused(true);
    setShowViewers(true);
    setIsLoadingViewers(true);
    try {
      const res = await api.get(`/stories/${currentStory.id}/viewers`);
      if (res.data && res.data.success) {
        setViewers(res.data.data || []);
      }
    } catch (err) {
      console.error("❌ Lỗi lấy danh sách viewers:", err);
    } finally {
      setIsLoadingViewers(false);
    }
  };

  // Xóa story
  const handleDeleteCurrentStory = async () => {
    if (!currentStory || !isOwner) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa tin này không?")) return;

    try {
      await api.delete(`/stories/${currentStory.id}`);
      if (onStoryDeleted) onStoryDeleted(currentStory.id);

      if (currentGroup.stories.length > 1) {
        if (storyIndex > 0) {
          setStoryIndex((prev) => prev - 1);
        }
      } else {
        onClose();
      }
    } catch (err) {
      alert("Lỗi khi xóa tin!");
    }
  };

  // Gửi câu trả lời tin nhắn (Reply to Story)
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || isSendingReply || !currentGroup?.author?.id) return;

    setIsSendingReply(true);
    try {
      // 1. Tạo hoặc lấy cuộc trò chuyện 1-1 qua gateway
      const convRes = await api.post("/conversations", {
        participantId: currentGroup.author.id,
      });

      const conversationId = convRes.data?.data?.id || convRes.data?.conversation?.id || convRes.data?.id;
      if (!conversationId) {
        throw new Error("Không khởi tạo được hội thoại!");
      }

      // 2. Gửi tin nhắn kiểu story_reply qua WebSocket
      const payload = {
        conversationId,
        content: replyText.trim(),
        type: "story_reply",
        metadata: {
          storyId: currentStory.id,
          storyMediaUrl: getMediaFileUrl(currentStory.media_id),
          storyCaption: currentStory.caption,
        },
      };

      if (chatSocket && chatSocket.connected) {
        chatSocket.emit("message:send", payload);
      } else {
        // Fallback endpoint if socket is unavailable
        await api.post(`/conversations/${conversationId}/messages`, payload);
      }

      setReplyText("");
      setReplySentSuccess(true);
      if (setToast) {
        setToast({ type: "info", message: `Đã gửi trả lời tin tới ${currentGroup.author.displayName}` });
      }
      setTimeout(() => setReplySentSuccess(false), 3000);
    } catch (err) {
      console.error("❌ Lỗi gửi trả lời story:", err);
      alert("Không thể gửi tin nhắn trả lời!");
    } finally {
      setIsSendingReply(false);
    }
  };

  // Xử lý bắn Emoji Reaction
  const handleSendEmojiReaction = async (emoji) => {
    // 1. Hiệu ứng Emoji bay lên màn hình
    const newReaction = {
      id: Date.now() + Math.random(),
      emoji,
      left: `${20 + Math.random() * 60}%`,
    };
    setFloatingReactions((prev) => [...prev, newReaction]);

    // Tự động dọn dẹp sau 1.5s
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 1500);

    // 2. Gửi tin nhắn reaction qua socket/API
    if (!currentGroup?.author?.id) return;
    try {
      const convRes = await api.post("/conversations", {
        participantId: currentGroup.author.id,
      });
      const conversationId = convRes.data?.data?.id || convRes.data?.conversation?.id || convRes.data?.id;
      if (!conversationId) return;

      const payload = {
        conversationId,
        content: emoji,
        type: "story_reply",
        metadata: {
          storyId: currentStory.id,
          storyMediaUrl: getMediaFileUrl(currentStory.media_id),
          storyCaption: currentStory.caption,
          isReaction: true,
        },
      };

      if (chatSocket && chatSocket.connected) {
        chatSocket.emit("message:send", payload);
      } else {
        await api.post(`/conversations/${conversationId}/messages`, payload);
      }
    } catch (err) {
      console.error("❌ Lỗi gửi reaction:", err);
    }
  };

  if (!currentGroup || !currentStory) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-fadeIn select-none">
      {/* Container xem story */}
      <div className="relative w-full max-w-md h-full max-h-[92vh] sm:max-h-[850px] bg-slate-950 sm:rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl border border-white/10">
        
        {/* Progress Bars ở trên cùng */}
        <div className="absolute top-0 inset-x-0 z-30 p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent space-y-3">
          <div className="flex space-x-1.5 px-1">
            {currentGroup.stories.map((story, idx) => {
              let width = "0%";
              if (idx < storyIndex) width = "100%";
              else if (idx === storyIndex) width = `${progress}%`;

              return (
                <div
                  key={story.id || idx}
                  className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-all duration-75 ease-linear"
                    style={{ width }}
                  />
                </div>
              );
            })}
          </div>

          {/* User Info Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-3">
              <img
                src={currentGroup.author.avatarUrl || "https://api.dicebear.com/7.x/bottts/svg?seed=user"}
                alt={currentGroup.author.displayName}
                className="w-9 h-9 rounded-full object-cover border-2 border-primary"
              />
              <div>
                <p className="text-sm font-bold text-white leading-tight">
                  {currentGroup.author.displayName}
                </p>
                <p className="text-[11px] text-slate-300 font-medium">
                  {formatRelativeTime(currentStory.created_at)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {isOwner && (
                <button
                  onClick={handleDeleteCurrentStory}
                  title="Xóa tin này"
                  className="p-1.5 hover:bg-white/20 text-slate-300 hover:text-red-400 rounded-full transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/20 text-slate-300 hover:text-white rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Story Media Content */}
        <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
          {currentStory.media_type === "video" ? (
            <HlsVideoPlayer
              mediaId={currentStory.media_id}
              isActive={true}
              controls={false}
              autoPlay={true}
              loop={false}
              className="w-full h-full object-contain"
              onTimeUpdate={(e) => {
                const v = e.target;
                if (v && v.duration && !isNaN(v.duration) && v.duration > 0) {
                  setProgress((v.currentTime / v.duration) * 100);
                }
              }}
              onEnded={() => handleNextStory()}
            />
          ) : (
            <img
              src={getMediaFileUrl(currentStory.media_id, "large")}
              alt="Story Content"
              className="w-full h-full object-contain"
            />
          )}

          {/* Floating Emoji Reaction Overlay */}
          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            {floatingReactions.map((r) => (
              <span
                key={r.id}
                className="absolute bottom-20 text-4xl animate-floatUp drop-shadow-lg"
                style={{ left: r.left }}
              >
                {r.emoji}
              </span>
            ))}
          </div>

          {/* Caption text overlay */}
          {currentStory.caption && (
            <div className="absolute bottom-24 inset-x-0 p-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent text-center z-20">
              <p className="text-white text-sm sm:text-base font-medium drop-shadow-md px-4 py-1.5 inline-block bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">
                {currentStory.caption}
              </p>
            </div>
          )}

          {/* Area cho click qua trái / qua phải */}
          <div
            onClick={handlePrevStory}
            className="absolute left-0 top-16 bottom-24 w-1/3 z-10 cursor-pointer"
          />
          <div
            onClick={handleNextStory}
            className="absolute right-0 top-16 bottom-24 w-1/3 z-10 cursor-pointer"
          />
        </div>

        {/* Navigation Arrows for Desktop */}
        {groupIndex > 0 || storyIndex > 0 ? (
          <button
            onClick={handlePrevStory}
            className="hidden sm:flex absolute left-[-60px] top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer backdrop-blur-md"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : null}

        {groupIndex < storyGroups.length - 1 || storyIndex < currentGroup.stories.length - 1 ? (
          <button
            onClick={handleNextStory}
            className="hidden sm:flex absolute right-[-60px] top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer backdrop-blur-md"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        ) : null}

        {/* Footer Area: Viewers list nút (dành cho owner) HOẶC Reply input + Reaction Emojis (dành cho viewer) */}
        <div className="z-30 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent space-y-2.5">
          {isOwner ? (
            <div className="flex items-center justify-between px-2">
              <button
                onClick={handleFetchViewers}
                className="flex items-center space-x-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-full backdrop-blur-md transition cursor-pointer"
              >
                <Eye className="w-4 h-4 text-primary" />
                <span>{currentStory.view_count || 0} người đã xem</span>
              </button>

              <span className="text-[11px] text-slate-400">Tin của bạn</span>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Thanh Icon Bày tỏ cảm xúc (Emoji Reactions Bar) */}
              <div className="flex items-center justify-around px-1 py-1">
                {["❤️", "😂", "😮", "😢", "🔥", "👏"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendEmojiReaction(emoji)}
                    className="text-2xl hover:scale-125 transition-transform duration-150 cursor-pointer active:scale-95 p-1 hover:bg-white/10 rounded-full"
                    title={`Bày tỏ cảm xúc ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Ô Nhập tin nhắn trả lời */}
              <form onSubmit={handleSendReply} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={replyText}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Trả lời ${currentGroup.author.displayName}...`}
                  className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-full text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition backdrop-blur-md"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSendingReply}
                  className="p-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 text-on-primary rounded-full transition cursor-pointer shadow-lg"
                >
                  {isSendingReply ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          )}

          {replySentSuccess && (
            <p className="text-center text-xs text-emerald-400 mt-1 font-medium animate-fadeIn">
              ✓ Đã gửi câu trả lời qua nhắn tin
            </p>
          )}
        </div>

        {/* Modal Danh Sách Viewers Drawer */}
        {showViewers && (
          <div className="absolute inset-x-0 bottom-0 top-1/3 z-40 bg-slate-900/95 backdrop-blur-2xl rounded-t-3xl border-t border-white/10 p-4 flex flex-col animate-slideUp">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <Eye className="w-4 h-4 text-primary" />
                <span>Người đã xem ({viewers.length})</span>
              </h4>
              <button
                onClick={() => {
                  setShowViewers(false);
                  setIsPaused(false);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {isLoadingViewers ? (
                <div className="flex justify-center py-8">
                  <Loader className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : viewers.length > 0 ? (
                viewers.map((v, i) => (
                  <div key={i} className="flex items-center justify-between px-1">
                    <div className="flex items-center space-x-3">
                      <img
                        src={v.user.avatarUrl || "https://api.dicebear.com/7.x/bottts/svg?seed=user"}
                        alt={v.user.displayName}
                        className="w-8 h-8 rounded-full object-cover border border-white/10"
                      />
                      <span className="text-sm font-semibold text-white">
                        {v.user.displayName}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {formatRelativeTime(v.viewedAt)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-slate-400 py-6">
                  Chưa có ai xem tin này
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default StoryViewer;
