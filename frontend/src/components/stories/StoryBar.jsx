import { useState, useEffect } from "react";
import { Plus, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import CreateStoryModal from "./CreateStoryModal";
import StoryViewer from "./StoryViewer";

const StoryBar = () => {
  const { user } = useAuth();
  const [storyGroups, setStoryGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewerState, setViewerState] = useState({
    isOpen: false,
    groupIndex: 0,
    storyIndex: 0,
  });

  const fetchFeedStories = async () => {
    try {
      const res = await api.get("/stories/feed");
      if (res.data && res.data.success) {
        setStoryGroups(res.data.data || []);
      }
    } catch (error) {
      console.error("❌ Lỗi lấy tin 24h:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedStories();
  }, []);

  const handleStoryCreated = () => {
    fetchFeedStories();
  };

  const handleStoryDeleted = () => {
    fetchFeedStories();
  };

  const handleOpenViewer = (groupIndex) => {
    setViewerState({
      isOpen: true,
      groupIndex,
      storyIndex: 0,
    });
  };

  const myStoryGroup = storyGroups.find((g) => g.author?.id === user?.id);

  return (
    <div className="w-full bg-surface-container-low/70 dark:bg-surface-container-high/60 backdrop-blur-2xl border border-outline-variant/10 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
      {/* Title Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          <h2 className="font-title-md text-base font-bold text-on-surface tracking-tight">
            Tin 24h
          </h2>
        </div>
        <span className="text-xs text-on-surface-variant font-medium">
          Tự biến mất sau 24 giờ
        </span>
      </div>

      {/* Horizontal Story List */}
      <div className="flex items-center space-x-4 overflow-x-auto pb-2 scrollbar-none select-none">
        {/* Nút Tạo tin mới của chính mình */}
        <div
          onClick={() => {
            if (myStoryGroup) {
              const myIndex = storyGroups.findIndex((g) => g.author?.id === user?.id);
              handleOpenViewer(myIndex);
            } else {
              setShowCreateModal(true);
            }
          }}
          className="flex flex-col items-center space-y-1.5 min-w-[72px] cursor-pointer group"
        >
          <div className="relative w-16 h-16 rounded-full p-[2px] border-2 border-dashed border-primary/60 group-hover:border-primary transition flex items-center justify-center">
            <img
              src={user?.avatarUrl || "https://api.dicebear.com/7.x/bottts/svg?seed=user"}
              alt={user?.displayName || "Tên của bạn"}
              className="w-full h-full rounded-full object-cover group-hover:scale-105 transition"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCreateModal(true);
              }}
              title="Tạo tin mới"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md hover:scale-110 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
          <span className="text-xs font-semibold text-on-surface text-center truncate max-w-[72px]">
            {myStoryGroup ? "Tin của bạn" : "Tạo tin"}
          </span>
        </div>

        {/* Danh sách Story của bạn bè */}
        {isLoading ? (
          <div className="flex space-x-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center space-y-1.5 animate-pulse">
                <div className="w-16 h-16 rounded-full bg-surface-container-highest dark:bg-slate-800" />
                <div className="w-12 h-3 bg-surface-container-highest dark:bg-slate-800 rounded-md" />
              </div>
            ))}
          </div>
        ) : (
          storyGroups
            .filter((g) => g.author?.id !== user?.id)
            .map((group) => {
              const actualIndex = storyGroups.findIndex((g) => g.author?.id === group.author?.id);
              return (
                <div
                  key={group.author?.id}
                  onClick={() => handleOpenViewer(actualIndex)}
                  className="flex flex-col items-center space-y-1.5 min-w-[72px] cursor-pointer group"
                >
                  <div
                    className={`w-16 h-16 rounded-full p-[2.5px] transition group-hover:scale-105 ${
                      group.hasUnviewed
                        ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 shadow-md shadow-rose-500/20"
                        : "border-2 border-outline-variant/30"
                    }`}
                  >
                    <img
                      src={
                        group.author?.avatarUrl ||
                        "https://api.dicebear.com/7.x/bottts/svg?seed=user"
                      }
                      alt={group.author?.displayName}
                      className="w-full h-full rounded-full object-cover border-2 border-surface dark:border-slate-900"
                    />
                  </div>
                  <span className="text-xs font-medium text-on-surface dark:text-slate-200 text-center truncate max-w-[72px]">
                    {group.author?.displayName}
                  </span>
                </div>
              );
            })
        )}
      </div>

      {/* Modal Tạo Story */}
      {showCreateModal && (
        <CreateStoryModal
          onClose={() => setShowCreateModal(false)}
          onUploadSuccess={handleStoryCreated}
        />
      )}

      {/* Modal Xem Story Fullscreen */}
      {viewerState.isOpen && (
        <StoryViewer
          storyGroups={storyGroups}
          initialGroupIndex={viewerState.groupIndex}
          initialStoryIndex={viewerState.storyIndex}
          currentUserId={user?.id}
          onClose={() => setViewerState({ isOpen: false, groupIndex: 0, storyIndex: 0 })}
          onStoryDeleted={handleStoryDeleted}
        />
      )}
    </div>
  );
};

export default StoryBar;
