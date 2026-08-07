import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Image, Video, X, Upload, Loader, Sparkles } from "lucide-react";
import api from "../../services/api";
import imageCompression from "browser-image-compression";

const CreateStoryModal = ({ onClose, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState("image"); // "image" | "video"
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    if (file.type.startsWith("video/")) {
      if (file.size > 50 * 1024 * 1024) {
        alert("Video dung lượng quá lớn (tối đa 50MB)");
        return;
      }
      setMediaType("video");
    } else if (file.type.startsWith("image/")) {
      if (file.size > 15 * 1024 * 1024) {
        alert("Ảnh dung lượng quá lớn (tối đa 15MB)");
        return;
      }
      setMediaType("image");
    } else {
      alert("Vui lòng chọn file hình ảnh hoặc video!");
      return;
    }
    setSelectedFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemoveMedia = () => {
    setSelectedFile(null);
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
      setMediaPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let fileToUpload = selectedFile;
      
      // Nén ảnh nếu là image
      if (mediaType === "image" && selectedFile.type !== "image/gif") {
        try {
          fileToUpload = await imageCompression(selectedFile, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
          });
        } catch (err) {
          fileToUpload = selectedFile;
        }
      }

      // 1. Upload media file
      const formData = new FormData();
      formData.append("file", fileToUpload);

      const uploadRes = await api.post("/media/upload", formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        },
      });

      const mediaId = uploadRes.data?.id;
      if (!mediaId) {
        throw new Error("Không lấy được Media ID!");
      }

      // 2. Tạo Story trong post-service
      const storyRes = await api.post("/stories", {
        mediaId,
        mediaType,
        caption: caption.trim() || undefined,
      });

      if (storyRes.data && storyRes.data.success) {
        onUploadSuccess(storyRes.data.data);
        onClose();
      }
    } catch (err) {
      console.error("❌ Lỗi đăng story:", err);
      alert(err.response?.data?.error || "Đã xảy ra lỗi khi tạo tin 24h!");
    } finally {
      setIsUploading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn select-none">
      <div className="bg-surface-container-high dark:bg-slate-900 border border-outline-variant/20 w-full max-w-md max-h-[85vh] p-4 sm:p-5 rounded-3xl shadow-2xl relative flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2.5 shrink-0 mb-3">
          <h3 className="text-sm font-bold text-on-surface dark:text-white uppercase tracking-wider flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <span>Tạo tin 24h mới</span>
          </h3>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1 hover:bg-surface-container-highest dark:hover:bg-white/10 rounded-full text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-white cursor-pointer transition disabled:opacity-30"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Form Container với min-h-0 để flexbox cuộn chuẩn */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          {/* Scrollable Body Area */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {!mediaPreview ? (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-outline-variant/40 hover:border-primary bg-surface-container-low/50 dark:bg-slate-800/50 rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 group"
              >
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-on-surface dark:text-slate-200">
                    Kéo và thả ảnh hoặc video vào đây
                  </p>
                  <p className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-0.5">
                    Hỗ trợ ảnh PNG, JPG, GIF hoặc video MP4 (tối đa 24h)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden bg-black max-h-[200px] flex items-center justify-center group">
                {mediaType === "video" ? (
                  <video
                    src={mediaPreview}
                    controls
                    className="max-h-[200px] w-auto object-contain mx-auto"
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="max-h-[200px] w-auto object-contain mx-auto"
                  />
                )}

                <button
                  type="button"
                  onClick={handleRemoveMedia}
                  disabled={isUploading}
                  className="absolute top-2 right-2 z-20 p-1.5 bg-black/70 hover:bg-black/90 text-white rounded-full transition cursor-pointer shadow-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Caption text */}
            <div>
              <label className="block text-[11px] font-medium text-on-surface-variant dark:text-slate-300 mb-1">
                Chú thích (tùy chọn)
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Thêm lời nhắn cho tin của bạn..."
                maxLength={150}
                disabled={isUploading}
                className="w-full px-3.5 py-2 bg-surface-container/60 dark:bg-slate-800 border border-outline-variant/20 rounded-xl text-xs text-on-surface dark:text-white placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
              />
            </div>

            {/* Upload progress */}
            {isUploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-primary">
                  <span>Đang tải lên...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-surface-container-highest dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fixed Footer Buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-2.5 border-t border-outline-variant/10 shrink-0 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-3.5 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="flex items-center space-x-1.5 px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-on-primary font-medium text-xs rounded-xl transition cursor-pointer shadow-md shadow-primary/20"
            >
              {isUploading ? (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang chia sẻ...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Chia sẻ ngay</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CreateStoryModal;
