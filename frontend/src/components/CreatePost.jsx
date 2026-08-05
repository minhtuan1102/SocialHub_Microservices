import { useState, useRef } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import MaterialIcon from "./MaterialIcon";
import { compressImageBeforeUpload } from "../utils/imageCompressor";

const CreatePost = ({ onPostCreated }) => {
    const { user } = useAuth();
    const [content, setContent] = useState("");
    const [visibility, setVisibility] = useState("public");
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    const handleFilesChange = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const newItems = files.map((file) => ({
            id: Math.random().toString(36).substring(2, 9),
            file,
            previewUrl: URL.createObjectURL(file),
            isVideo: file.type.startsWith("video/")
        }));

        setSelectedFiles((prev) => [...prev, ...newItems]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleRemoveFile = (idToRemove) => {
        setSelectedFiles((prev) => {
            const item = prev.find((f) => f.id === idToRemove);
            if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
            return prev.filter((f) => f.id !== idToRemove);
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim() && selectedFiles.length === 0) return;

        setIsSubmitting(true);
        let mediaIds = [];

        try {
            if (selectedFiles.length > 0) {
                setIsUploading(true);
                const uploadPromises = selectedFiles.map(async (item) => {
                    let fileToUpload = item.file;
                    if (!item.isVideo && item.file.type.startsWith('image/') && item.file.type !== 'image/gif') {
                        try {
                            fileToUpload = await compressImageBeforeUpload(item.file);
                        } catch (err) {
                            fileToUpload = item.file;
                        }
                    }

                    const formData = new FormData();
                    formData.append("file", fileToUpload);
                    const res = await api.post("/media/upload", formData);
                    return res.data?.id;
                });

                const uploadedIds = await Promise.all(uploadPromises);
                mediaIds = uploadedIds.filter(Boolean);
                setIsUploading(false);
            }

            const postRes = await api.post("/posts", {
                content,
                mediaIds,
                visibility
            });

            if (postRes.data && postRes.data.success) {
                setContent("");
                setVisibility("public");
                selectedFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
                setSelectedFiles([]);
                if (onPostCreated) onPostCreated(postRes.data.data);
            }
        } catch (error) {
        } finally {
            setIsSubmitting(false);
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-[0px_10px_40px_rgba(142,148,242,0.06)] dark:shadow-[0px_10px_40px_rgba(0,0,0,0.3)] border border-outline-variant/10 mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-start space-x-3 sm:space-x-4">
                    <img
                        src={user?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        alt="Avatar"
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-outline-variant/20 object-cover ring-2 ring-primary-fixed/50 shrink-0"
                    />
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={`${user?.displayName} ơi, hôm nay bạn đang nghĩ gì thế?`}
                        className="flex-1 bg-transparent border-none text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none resize-none min-h-[70px] font-body-lg text-body-lg"
                    />
                </div>

                {/* Danh sách xem trước Ảnh / Video */}
                {selectedFiles.length > 0 && (
                    <div className={`grid gap-2 rounded-2xl overflow-hidden border border-outline-variant/10 p-2 bg-surface-container-low/40 ${
                        selectedFiles.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
                    }`}>
                        {selectedFiles.map((item) => (
                            <div key={item.id} className="relative group rounded-xl overflow-hidden bg-black/5 aspect-video flex items-center justify-center">
                                {item.isVideo ? (
                                    <video src={item.previewUrl} className="w-full h-full object-cover" controls />
                                ) : (
                                    <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveFile(item.id)}
                                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/85 rounded-full text-white transition cursor-pointer shadow-md"
                                >
                                    <MaterialIcon name="close" size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
                    <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        ref={fileInputRef}
                        onChange={handleFilesChange}
                        className="hidden"
                    />
                    <div className="flex items-center space-x-2">
                        {/* Selector cho Quyền riêng tư */}
                        <select
                            value={visibility}
                            onChange={(e) => setVisibility(e.target.value)}
                            className="bg-surface-container-high/60 border border-outline-variant/10 rounded-xl px-3 py-1.5 font-label-sm text-label-sm text-on-surface cursor-pointer outline-none focus:ring-1 focus:ring-primary transition"
                        >
                            <option value="public">🌍 Công khai</option>
                            <option value="friends">👥 Bạn bè</option>
                        </select>

                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isSubmitting}
                            className="flex items-center space-x-2 px-4 py-2 bg-surface-container-high/60 hover:bg-surface-container-highest rounded-xl text-on-surface-variant border border-outline-variant/10 transition cursor-pointer disabled:opacity-50 font-label-sm text-label-sm"
                        >
                            <MaterialIcon name="photo_camera" size={18} className="text-secondary" />
                            <MaterialIcon name="videocam" size={18} className="text-primary" />
                            <span>Ảnh / Video</span>
                        </button>
                    </div>

                    {/* Nút Đăng Bài */}
                    <button
                        type="submit"
                        disabled={isSubmitting || (!content.trim() && selectedFiles.length === 0)}
                        className="flex items-center space-x-2 px-5 py-2.5 bg-primary hover:bg-primary/90 rounded-xl text-on-primary font-label-sm text-label-sm transition duration-200 active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
                    >
                        {isSubmitting ? (
                            <MaterialIcon name="progress_activity" size={18} className="animate-spin" />
                        ) : (
                            <MaterialIcon name="send" size={18} />
                        )}
                        <span>{isSubmitting ? (isUploading ? "Đang tải media..." : "Đang đăng...") : "Đăng bài"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreatePost;
