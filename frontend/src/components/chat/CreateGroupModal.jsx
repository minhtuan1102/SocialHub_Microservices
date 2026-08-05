import { Circle, X } from "lucide-react";
import MaterialIcon from "../MaterialIcon";

const CreateGroupModal = ({
    onClose,
    groupName,
    setGroupName,
    friends,
    selectedFriends,
    toggleSelectFriend,
    onSubmit
}) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/20 rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-fadeIn">
                <div className="flex items-center justify-between p-4 border-b border-outline-variant/10 bg-surface-container-low/60 dark:bg-surface-container-low/80">
                    <h3 className="font-bold text-on-surface text-sm">Tạo nhóm chat mới</h3>
                    <button
                        onClick={onClose}
                        className="text-on-surface-variant hover:text-on-surface transition cursor-pointer p-1 rounded-lg hover:bg-surface-container-high/60"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-4 space-y-4 flex-1 overflow-y-auto">
                    <div>
                        <label className="block text-[10px] text-on-surface-variant font-semibold uppercase mb-1">Tên nhóm</label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Ví dụ: Nhóm Học Tập..."
                            className="w-full bg-surface-container-high/60 dark:bg-surface-container-high/80 border border-outline-variant/10 rounded-xl px-3 py-2 text-base sm:text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] text-on-surface-variant font-semibold uppercase mb-2">Chọn thành viên</label>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {friends.length > 0 ? (
                                friends.map((f) => {
                                    const isSelected = selectedFriends.includes(f.id);
                                    return (
                                        <div
                                            key={f.id}
                                            onClick={() => toggleSelectFriend(f.id)}
                                            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer border transition ${
                                                isSelected ? "bg-primary-container text-on-primary-container border-primary/30" : "bg-surface-container-high/40 border-outline-variant/10 hover:bg-surface-container-high"
                                            }`}
                                        >
                                            <div className="flex items-center space-x-2.5">
                                                <img
                                                    src={f.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                    className="w-7 h-7 rounded-full object-cover border border-outline-variant/20"
                                                    alt="Avatar"
                                                />
                                                <span className="text-xs font-medium text-on-surface">{f.displayName}</span>
                                            </div>
                                            <Circle className={`w-4 h-4 ${isSelected ? "fill-primary text-primary" : "text-on-surface-variant/40"}`} />
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-[10px] text-on-surface-variant/60 italic text-center py-4">Bạn chưa có người bạn nào để tạo nhóm.</p>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!groupName.trim() || selectedFriends.length === 0}
                        className="w-full bg-primary hover:opacity-90 text-on-primary font-semibold py-2.5 rounded-xl text-xs transition disabled:opacity-50 cursor-pointer shadow-md"
                    >
                        Tạo nhóm
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateGroupModal;
