import { useState, useEffect, Component } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import ChatBox from "./ChatBox";
import IncomingCallModal from "./IncomingCallModal";
import CallWindow from "./CallWindow";
import MaterialIcon from "./MaterialIcon";

// ErrorBoundary
class ChatBoxErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, info) {
        console.error("ChatBox Error:", error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="w-full sm:w-80 bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/10 rounded-t-3xl shadow-xl flex items-center justify-between p-4">
                    <p className="text-xs text-error">Không thể mở cuộc trò chuyện</p>
                    <button onClick={this.props.onClose} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                        <MaterialIcon name="close" size={16} />
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const ChatWidget = () => {
    const { user: currentUser } = useAuth();
    const { 
        onlineUsers, 
        chatSocket, 
        incomingCall, 
        activeCall, 
        setActiveCall, 
        handleAcceptIncomingCall, 
        handleRejectIncomingCall 
    } = useSocket();
    const [friends, setFriends] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openChats, setOpenChats] = useState([]);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [selectedMembers, setSelectedMembers] = useState([]);

    useEffect(() => {
        const fetchFriendsList = async () => {
            setIsLoading(true);
            try {
                const res = await api.get("/friends");
                if (res.data && res.data.success) {
                    setFriends(res.data.data || []);
                }
            } catch (error) {
                console.error("❌ Lỗi lấy danh sách bạn bè ở ChatWidget:", error.message);
            } finally {
                setIsLoading(false);
            }
        };

        if (currentUser) {
            fetchFriendsList();
        }

        window.addEventListener("friends-updated", fetchFriendsList);
        return () => {
            window.removeEventListener("friends-updated", fetchFriendsList);
        };
    }, [currentUser]);

    const handleOpenChat = async (friend) => {
        try {
            const res = await api.post("/conversations", { participantId: friend.id });
            if (res.data && res.data.success) {
                const conversation = res.data.data;
                if (!openChats.some(c => c._id === conversation._id || c.id === conversation.id)) {
                    setOpenChats(prev => {
                        const newChats = [...prev, conversation];
                        if (newChats.length > 3) newChats.shift();
                        return newChats;
                    });
                }
            }
        } catch (error) {
            console.error("❌ Lỗi mở cuộc hội thoại:", error);
            alert("Không thể khởi tạo cuộc trò chuyện!");
        }
    };

    const handleCloseChat = (conversationId) => {
        setOpenChats(prev => prev.filter(c => (c._id !== conversationId && c.id !== conversationId)));
    };

    useEffect(() => {
        const handleOpenChatEvent = (e) => {
            const friend = e.detail;
            handleOpenChat(friend);
        };

        const handleOpenConversationEvent = async (e) => {
            const conversation = e.detail;
            if (!conversation) return;
            
            const convId = conversation._id || conversation.id;
            if (!convId) return;

            const hasValidParticipants = Array.isArray(conversation.participants) && conversation.participants.length > 0;
            let fullConversation = conversation;
            if (!hasValidParticipants) {
                try {
                    const res = await api.get(`/conversations/${convId}`);
                    if (res.data?.success) {
                        fullConversation = res.data.data;
                    }
                } catch (err) {
                    console.error("❌ Lỗi fetch cuộc hội thoại khi mở chat:", err);
                    return;
                }
            }

            setOpenChats(prev => {
                const id = fullConversation._id || fullConversation.id;
                if (prev.some(c => (c._id || c.id) === id)) return prev;
                const newChats = [...prev, fullConversation];
                if (newChats.length > 3) newChats.shift();
                return newChats;
            });
        };

        window.addEventListener("open-chat", handleOpenChatEvent);
        window.addEventListener("open-chat-conversation", handleOpenConversationEvent);
        return () => {
            window.removeEventListener("open-chat", handleOpenChatEvent);
            window.removeEventListener("open-chat-conversation", handleOpenConversationEvent);
        };
    }, [openChats]);

    useEffect(() => {
        if (!chatSocket) return;

        const handleIncomingMessage = async (message) => {
            if (window.location.pathname === "/messages") return;

            const isAlreadyOpen = openChats.some(c => c._id === message.conversationId || c.id === message.conversationId);
            if (!isAlreadyOpen) {
                try {
                    const res = await api.get(`/conversations/${message.conversationId}`);
                    if (res.data && res.data.success) {
                        const conversation = res.data.data;
                        setOpenChats(prev => {
                            if (prev.some(c => c._id === conversation._id || c.id === conversation.id)) return prev;
                            const newChats = [...prev, conversation];
                            if (newChats.length > 3) newChats.shift();
                            return newChats;
                        });
                    }
                } catch (err) {
                    console.error("❌ Lỗi lấy thông tin cuộc hội thoại khi có tin nhắn đến:", err);
                }
            }
        };

        chatSocket.on("message:received", handleIncomingMessage);
        return () => {
            chatSocket.off("message:received", handleIncomingMessage);
        };
    }, [chatSocket, openChats]);

    const handleToggleMember = (friendId) => {
        setSelectedMembers(prev =>
            prev.includes(friendId)
                ? prev.filter(id => id !== friendId)
                : [...prev, friendId]
        );
    };

    const handleCreateGroupSubmit = async (e) => {
        e.preventDefault();
        if (!groupName.trim() || selectedMembers.length === 0) return;

        try {
            const res = await api.post("/groups", {
                name: groupName.trim(),
                memberIds: selectedMembers
            });
            if (res.data && res.data.success) {
                const newGroup = res.data.data;
                const convRes = await api.get(`/conversations/${newGroup.conversationId}`);
                if (convRes.data && convRes.data.success) {
                    const conversation = convRes.data.data;
                    setOpenChats(prev => {
                        if (prev.some(c => c._id === conversation._id || c.id === conversation.id)) return prev;
                        const newChats = [...prev, conversation];
                        if (newChats.length > 3) newChats.shift();
                        return newChats;
                    });
                }
                setGroupName("");
                setSelectedMembers([]);
                setShowCreateGroupModal(false);
            }
        } catch (err) {
            console.error("❌ Lỗi tạo nhóm chat:", err);
            alert("Không thể tạo nhóm chat!");
        }
    };

    if (!currentUser) return null;

    const onlineCount = friends.filter(f => onlineUsers[f.id] === true).length;

    return (
        <>
            {/* Sidebar cố định bên phải hiển thị danh sách bạn bè */}
            <aside className="hidden lg:flex w-64 bg-surface-container-low/40 dark:bg-surface-container-high/40 backdrop-blur-2xl border-l border-outline-variant/10 p-5 fixed right-0 top-0 h-screen flex-col pt-20 shadow-sm">
                <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3 mb-4">
                    <div className="flex items-center space-x-2">
                        <MaterialIcon name="group" className="text-primary" size={20} />
                        <h3 className="font-headline-md text-sm text-on-surface">Bạn bè ({friends.length})</h3>
                    </div>
                    <button
                        onClick={() => setShowCreateGroupModal(true)}
                        title="Tạo nhóm chat"
                        className="p-1 hover:bg-surface-container-high rounded-xl text-on-surface-variant hover:text-primary transition cursor-pointer border border-outline-variant/10"
                    >
                        <MaterialIcon name="group_add" size={18} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <MaterialIcon name="progress_activity" size={20} className="text-primary animate-spin" />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col justify-between overflow-hidden">
                        {friends.length > 0 ? (
                            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 no-scrollbar">
                                {friends.map(friend => {
                                    const isOnline = onlineUsers[friend.id] === true;

                                    return (
                                        <div
                                            key={friend.id}
                                            className="flex items-center space-x-3 p-2 rounded-2xl hover:bg-surface-container-high/60 transition group"
                                        >
                                            <Link
                                                to={`/profile/${friend.id}`}
                                                className="relative cursor-pointer hover:opacity-85 transition block shrink-0"
                                            >
                                                <img
                                                    src={friend.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                    className="w-10 h-10 rounded-full object-cover border border-outline-variant/20"
                                                    alt="Avatar"
                                                />
                                                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface ${
                                                    isOnline ? "bg-emerald-500 animate-pulse" : "bg-on-surface-variant/40"
                                                }`} />
                                            </Link>

                                            <div
                                                onClick={() => handleOpenChat(friend)}
                                                className="truncate flex-1 cursor-pointer"
                                            >
                                                <p className="text-xs font-semibold text-on-surface group-hover:text-primary truncate transition">
                                                    {friend.displayName}
                                                </p>
                                                <p className="text-[10px] text-on-surface-variant">
                                                    {isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-6 text-center">
                                <p className="text-on-surface-variant text-xs mb-3">Chưa có bạn bè trong danh sách.</p>
                            </div>
                        )}

                        {/* Gợi ý kết bạn */}
                        <div className="pt-4 border-t border-outline-variant/10 mt-2 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-1.5">
                                    <MaterialIcon name="auto_awesome" size={16} className="text-secondary" />
                                    <h4 className="font-headline-md text-xs text-on-surface">Gợi ý kết bạn</h4>
                                </div>
                                {onlineCount > 0 && (
                                    <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                        {onlineCount} online
                                    </span>
                                )}
                            </div>
                            <div className="bg-surface-container-low/60 border border-outline-variant/10 rounded-2xl p-3 space-y-2">
                                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                    {onlineCount > 0 
                                        ? `Đang có ${onlineCount} bạn bè trực tuyến sẵn sàng trò chuyện!` 
                                        : "Khám phá thêm những người bạn mới trên SocialHub."}
                                </p>
                                <Link
                                    to="/friends"
                                    className="flex items-center justify-center space-x-1.5 w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
                                >
                                    <MaterialIcon name="person_add" size={14} />
                                    <span>Tìm bạn mới</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* Container chứa các ô chat nổi */}
            <div className="fixed bottom-16 sm:bottom-0 right-0 sm:right-6 lg:right-72 inset-x-0 sm:inset-x-auto z-40 flex items-end justify-end space-x-4 pointer-events-none px-2 sm:px-0">
                {openChats.map(conv => {
                    const convKey = conv._id || conv.id;
                    if (!convKey) return null;
                    return (
                        <div key={convKey} className="pointer-events-auto w-full sm:w-auto">
                            <ChatBoxErrorBoundary onClose={() => handleCloseChat(convKey)}>
                                <ChatBox
                                    conversation={{
                                        ...conv,
                                        isOnline: Array.isArray(conv.participants)
                                            ? conv.participants.some(p => {
                                                const pId = p.userId || p.id || p._id;
                                                return pId && pId !== currentUser.id && onlineUsers[pId] === true;
                                              })
                                            : false
                                    }}
                                    onClose={() => handleCloseChat(convKey)}
                                    currentUserId={currentUser.id}
                                />
                            </ChatBoxErrorBoundary>
                        </div>
                    );
                })}
            </div>

            {/* Modal Tạo Nhóm Chat */}
            {showCreateGroupModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-slide-up">
                        <div className="flex items-center justify-between p-4 border-b border-outline-variant/10 bg-surface-container-low/40">
                            <h3 className="font-headline-md text-sm text-on-surface">Tạo nhóm chat</h3>
                            <button
                                onClick={() => {
                                    setShowCreateGroupModal(false);
                                    setGroupName("");
                                    setSelectedMembers([]);
                                }}
                                className="text-on-surface-variant hover:text-on-surface transition cursor-pointer p-1 rounded-full hover:bg-surface-container-high"
                            >
                                <MaterialIcon name="close" size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateGroupSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">Tên nhóm</label>
                                <input
                                    type="text"
                                    required
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="Nhập tên nhóm..."
                                    className="w-full bg-surface-container-low/60 border border-outline-variant/10 rounded-xl px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition"
                                />
                            </div>
                            
                            <div>
                                <label className="block font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider mb-1.5">
                                    Chọn thành viên ({selectedMembers.length})
                                </label>
                                {friends.length > 0 ? (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                                        {friends.map(friend => (
                                            <div
                                                key={friend.id}
                                                onClick={() => handleToggleMember(friend.id)}
                                                className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer ${
                                                    selectedMembers.includes(friend.id)
                                                        ? "bg-primary-container/20 border-primary/30"
                                                        : "bg-surface-container-low/40 border-transparent hover:bg-surface-container-high"
                                                }`}
                                            >
                                                <div className="flex items-center space-x-2.5">
                                                    <img
                                                        src={friend.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                        className="w-7 h-7 rounded-full object-cover border border-outline-variant/20"
                                                        alt="Friend Avatar"
                                                    />
                                                    <span className="text-xs text-on-surface font-medium">{friend.displayName}</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMembers.includes(friend.id)}
                                                    readOnly
                                                    className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-on-surface-variant/60 text-[10px] py-4">Không có bạn bè để tạo nhóm.</p>
                                )}
                            </div>
                            
                            <button
                                type="submit"
                                disabled={!groupName.trim() || selectedMembers.length === 0}
                                className="w-full bg-primary disabled:opacity-50 hover:bg-primary/90 text-on-primary font-semibold py-2 px-4 rounded-xl text-xs transition cursor-pointer shadow-md"
                            >
                                Tạo nhóm
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {incomingCall && (
                <IncomingCallModal
                    incomingCall={incomingCall}
                    onAccept={handleAcceptIncomingCall}
                    onReject={handleRejectIncomingCall}
                />
            )}

            {activeCall && (
                <CallWindow
                    activeCall={activeCall}
                    chatSocket={chatSocket}
                    currentUserId={currentUser.id}
                    onClose={() => setActiveCall(null)}
                />
            )}
        </>
    );
};

export default ChatWidget;
