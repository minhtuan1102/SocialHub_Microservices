import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { formatRelativeTime } from "../utils/dateUtils";
import MaterialIcon from "./MaterialIcon";

const TopHeaderNav = ({ isDark, setIsDark }) => {
    const { user, logout } = useAuth();
    const { unreadCount, setUnreadCount, onlineUsers, chatSocket } = useSocket();
    const navigate = useNavigate();

    // Quản lý dropdown đang mở: 'friends' | 'messages' | 'notifications' | null
    const [activeDropdown, setActiveDropdown] = useState(null);

    // State dữ liệu Bạn bè
    const [friendRequests, setFriendRequests] = useState([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(false);
    const [processingRequestId, setProcessingRequestId] = useState(null);

    // State dữ liệu Tin nhắn
    const [conversations, setConversations] = useState([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    // State dữ liệu Thông báo
    const [notifications, setNotifications] = useState([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

    const containerRef = useRef(null);

    // Click ngoài để tự đóng dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 1. Tải Lời mời kết bạn
    const fetchFriendRequests = async () => {
        setIsLoadingFriends(true);
        try {
            const res = await api.get("/friends/requests?type=received");
            if (res.data && res.data.success) {
                setFriendRequests(res.data.data || []);
            }
        } catch (err) {
            console.error("Lỗi lấy lời mời kết bạn:", err);
        } finally {
            setIsLoadingFriends(false);
        }
    };

    // 2. Tải Cuộc trò chuyện gần đây
    const fetchConversations = async () => {
        setIsLoadingMessages(true);
        try {
            const res = await api.get("/conversations?page=1&limit=6");
            if (res.data && res.data.success) {
                setConversations(res.data.data || []);
            }
        } catch (err) {
            console.error("Lỗi lấy cuộc hội thoại:", err);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    // 3. Tải Thông báo
    const fetchNotifications = async () => {
        setIsLoadingNotifications(true);
        try {
            const res = await api.get("/notifications");
            if (res.data && res.data.success) {
                setNotifications(res.data.data || []);
            }
        } catch (err) {
            console.error("Lỗi lấy danh sách thông báo:", err);
        } finally {
            setIsLoadingNotifications(false);
        }
    };

    // Lắng nghe sự kiện thông báo & tin nhắn realtime và tải dữ liệu ban đầu
    useEffect(() => {
        fetchFriendRequests();
        fetchConversations();
        fetchNotifications();

        const handleNewNotification = (e) => {
            const newNotif = e.detail;
            setNotifications(prev => {
                if (prev.some(n => n.id === newNotif.id)) return prev;
                return [newNotif, ...prev];
            });
        };
        window.addEventListener("notification-received", handleNewNotification);
        return () => window.removeEventListener("notification-received", handleNewNotification);
    }, []);

    // Lắng nghe socket tin nhắn realtime để cập nhật danh sách hội thoại dropdown
    useEffect(() => {
        if (!chatSocket) return;

        const handleMessageReceived = () => {
            fetchConversations();
        };

        const handleReadAck = (ack) => {
            setConversations(prev => prev.map(c => {
                const id = c.id || c._id;
                if (String(id) === String(ack.conversationId)) {
                    return {
                        ...c,
                        unreadCount: 0,
                        isUnread: false,
                        lastMessage: c.lastMessage ? { ...c.lastMessage, isRead: true } : c.lastMessage
                    };
                }
                return c;
            }));
        };

        chatSocket.on("message:received", handleMessageReceived);
        chatSocket.on("message:read:ack", handleReadAck);

        return () => {
            chatSocket.off("message:received", handleMessageReceived);
            chatSocket.off("message:read:ack", handleReadAck);
        };
    }, [chatSocket]);

    // Tính số lượng cuộc trò chuyện chưa đọc
    const unreadMessagesCount = conversations.reduce((acc, conv) => {
        const isUnread = conv.unreadCount > 0 || conv.isUnread || 
            (conv.lastMessage && !conv.lastMessage.isRead && (conv.lastMessage.senderId || conv.lastMessage.sender) !== user?.id);
        return isUnread ? acc + 1 : acc;
    }, 0);

    // Bật/Tắt Dropdown
    const toggleDropdown = (name) => {
        if (activeDropdown === name) {
            setActiveDropdown(null);
            return;
        }

        setActiveDropdown(name);
        if (name === "friends") fetchFriendRequests();
        if (name === "messages") fetchConversations();
        if (name === "notifications") fetchNotifications();
    };

    // Chấp nhận lời mời kết bạn
    const handleAcceptRequest = async (e, requestId) => {
        e.stopPropagation();
        setProcessingRequestId(requestId);
        try {
            const res = await api.put(`/friends/requests/${requestId}/accept`);
            if (res.data && res.data.success) {
                setFriendRequests(prev => prev.filter(req => req.id !== requestId));
                window.dispatchEvent(new CustomEvent("friends-updated"));
            }
        } catch (err) {
            console.error("Lỗi chấp nhận lời mời:", err);
        } finally {
            setProcessingRequestId(null);
        }
    };

    // Từ chối lời mời kết bạn
    const handleRejectRequest = async (e, requestId) => {
        e.stopPropagation();
        setProcessingRequestId(requestId);
        try {
            const res = await api.put(`/friends/requests/${requestId}/reject`);
            if (res.data && res.data.success) {
                setFriendRequests(prev => prev.filter(req => req.id !== requestId));
            }
        } catch (err) {
            console.error("Lỗi từ chối lời mời:", err);
        } finally {
            setProcessingRequestId(null);
        }
    };

    // Mở khung chat khi click vào cuộc hội thoại
    const handleSelectConversation = (conv) => {
        setActiveDropdown(null);
        if (!conv) return;
        
        const convId = conv.id || conv._id;
        setConversations(prev => prev.map(c => {
            if ((c.id || c._id) === convId) {
                return {
                    ...c,
                    unreadCount: 0,
                    isUnread: false,
                    lastMessage: c.lastMessage ? { ...c.lastMessage, isRead: true } : c.lastMessage
                };
            }
            return c;
        }));

        if (chatSocket && conv.lastMessage && (conv.lastMessage.senderId || conv.lastMessage.sender) !== user?.id) {
            chatSocket.emit("message:read", {
                conversationId: convId,
                messageId: conv.lastMessage.id || conv.lastMessage._id || null
            });
        }

        window.dispatchEvent(new CustomEvent("open-chat-conversation", { detail: conv }));
    };

    // Đánh dấu 1 thông báo đã đọc và điều hướng
    const handleNotificationClick = async (notif) => {
        setActiveDropdown(null);
        if (!notif.isRead) {
            try {
                const res = await api.put(`/notifications/${notif.id}/read`);
                if (res.data && res.data.success) {
                    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
                    setUnreadCount(prev => Math.max(0, prev - 1));
                }
            } catch (err) {
                console.error("Lỗi đánh dấu đã đọc:", err);
            }
        }

        if (notif.type === "friend_request") {
            navigate("/friends");
        } else if (notif.type === "friend_accepted") {
            if (notif.fromUser?.id) {
                navigate(`/profile/${notif.fromUser.id}`);
            } else {
                navigate("/friends");
            }
        } else if (["post_liked", "post_commented", "post_shared"].includes(notif.type) || notif.referenceType === "post") {
            if (notif.referenceId) {
                navigate(`/post/${notif.referenceId}`);
            } else {
                navigate("/");
            }
        } else if (notif.type === "new_message") {
            navigate("/messages");
        } else if (notif.referenceId) {
            navigate(`/post/${notif.referenceId}`);
        } else if (notif.fromUser?.id) {
            navigate(`/profile/${notif.fromUser.id}`);
        } else {
            navigate("/");
        }
    };

    // Đánh dấu tất cả thông báo là đã đọc
    const handleMarkAllNotificationsRead = async () => {
        try {
            const res = await api.put("/notifications/read-all");
            if (res.data && res.data.success) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
            }
        } catch (err) {
            console.error("Lỗi đọc tất cả thông báo:", err);
        }
    };

    const formatTimeAgo = (dateString) => {
        if (!dateString) return "";
        return formatRelativeTime(dateString);
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case "post_liked":
                return <MaterialIcon name="favorite" filled className="text-error" size={16} />;
            case "post_commented":
                return <MaterialIcon name="chat_bubble" filled className="text-primary" size={16} />;
            case "friend_request":
                return <MaterialIcon name="person_add" className="text-secondary" size={16} />;
            case "friend_accepted":
                return <MaterialIcon name="person_check" className="text-secondary" size={16} />;
            case "post_shared":
                return <MaterialIcon name="share" className="text-tertiary" size={16} />;
            default:
                return <MaterialIcon name="notifications" className="text-primary" size={16} />;
        }
    };

    return (
        <div ref={containerRef} className="relative flex items-center space-x-3">
            
            {/* 1. ICON BẠN BÈ */}
            <div className="relative">
                <button
                    onClick={() => toggleDropdown("friends")}
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                        activeDropdown === "friends"
                            ? "bg-primary text-on-primary shadow-lg scale-105"
                            : "bg-surface-container-low/60 hover:bg-surface-container-high/60 text-on-surface-variant hover:text-primary border border-outline-variant/10 active:scale-95"
                    }`}
                    title="Lời mời kết bạn"
                >
                    <MaterialIcon name="people" size={20} filled={activeDropdown === "friends"} />
                    {friendRequests.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-error text-on-error text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-md">
                            {friendRequests.length > 9 ? "9+" : friendRequests.length}
                        </span>
                    )}
                </button>

                {/* Dropdown Lời Mời Kết Bạn */}
                {activeDropdown === "friends" && (
                    <div className="absolute right-0 mt-3 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/10 rounded-2xl shadow-[0_20px_60px_rgba(142,148,242,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-50 overflow-hidden animate-slide-up">
                        <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/40">
                            <div className="flex items-center space-x-2">
                                <MaterialIcon name="people" className="text-primary" size={18} />
                                <h3 className="font-bold text-on-surface text-sm">Lời mời kết bạn</h3>
                                {friendRequests.length > 0 && (
                                    <span className="bg-primary-container/40 text-on-primary-container text-xs font-semibold px-2 py-0.5 rounded-full">
                                        {friendRequests.length}
                                    </span>
                                )}
                            </div>
                            <Link 
                                to="/friends" 
                                onClick={() => setActiveDropdown(null)} 
                                className="text-xs text-primary hover:underline font-medium flex items-center"
                            >
                                Xem tất cả <MaterialIcon name="chevron_right" size={16} />
                            </Link>
                        </div>

                        <div className="max-h-[380px] overflow-y-auto divide-y divide-outline-variant/5">
                            {isLoadingFriends ? (
                                <div className="p-8 flex flex-col items-center justify-center text-on-surface-variant/60">
                                    <MaterialIcon name="progress_activity" className="animate-spin text-primary mb-2" size={24} />
                                    <span className="text-xs">Đang tải lời mời...</span>
                                </div>
                            ) : friendRequests.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-3 text-on-surface-variant">
                                        <MaterialIcon name="person_add" size={24} />
                                    </div>
                                    <p className="text-sm font-medium text-on-surface">Không có lời mời kết bạn mới</p>
                                    <p className="text-xs text-on-surface-variant mt-1">Các yêu cầu kết bạn mới sẽ hiển thị tại đây.</p>
                                </div>
                            ) : (
                                friendRequests.map((req) => {
                                    const sender = req.sender || {};
                                    return (
                                        <div 
                                            key={req.id} 
                                            className="p-3.5 hover:bg-surface-container-low/60 transition flex items-center justify-between space-x-3"
                                        >
                                            <Link 
                                                to={`/profile/${sender.id}`} 
                                                onClick={() => setActiveDropdown(null)} 
                                                className="flex items-center space-x-3 flex-1 min-w-0"
                                            >
                                                <img 
                                                    src={sender.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"} 
                                                    className="w-11 h-11 rounded-full object-cover border border-outline-variant/20 shrink-0" 
                                                    alt="Avatar" 
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-sm text-on-surface hover:text-primary truncate">
                                                        {sender.displayName || "Người dùng"}
                                                    </p>
                                                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                                                        {formatTimeAgo(req.createdAt)}
                                                    </p>
                                                </div>
                                            </Link>

                                            <div className="flex items-center space-x-1.5 shrink-0">
                                                {processingRequestId === req.id ? (
                                                    <MaterialIcon name="progress_activity" className="animate-spin text-primary" size={18} />
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={(e) => handleAcceptRequest(e, req.id)}
                                                            className="bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold px-3 py-1.5 rounded-xl transition shadow-sm cursor-pointer"
                                                        >
                                                            Đồng ý
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleRejectRequest(e, req.id)}
                                                            className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant text-xs font-semibold px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                                                        >
                                                            Xóa
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 2. ICON TIN NHẮN */}
            <div className="relative">
                <button
                    onClick={() => toggleDropdown("messages")}
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                        activeDropdown === "messages"
                            ? "bg-primary text-on-primary shadow-lg scale-105"
                            : "bg-surface-container-low/60 hover:bg-surface-container-high/60 text-on-surface-variant hover:text-primary border border-outline-variant/10 active:scale-95"
                    }`}
                    title="Tin nhắn"
                >
                    <MaterialIcon name="chat_bubble_outline" size={20} filled={activeDropdown === "messages"} />
                    {unreadMessagesCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-error text-on-error text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-md">
                            {unreadMessagesCount > 9 ? "9+" : unreadMessagesCount}
                        </span>
                    )}
                </button>

                {/* Dropdown Hộp Thư Tin Nhắn */}
                {activeDropdown === "messages" && (
                    <div className="absolute right-0 mt-3 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/10 rounded-2xl shadow-[0_20px_60px_rgba(142,148,242,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-50 overflow-hidden animate-slide-up">
                        <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/40">
                            <div className="flex items-center space-x-2">
                                <MaterialIcon name="chat_bubble" className="text-primary" size={18} />
                                <h3 className="font-bold text-on-surface text-sm">Tin nhắn gần đây</h3>
                            </div>
                            <Link 
                                to="/messages" 
                                onClick={() => setActiveDropdown(null)} 
                                className="text-xs text-primary hover:underline font-medium flex items-center"
                            >
                                Xem tất cả <MaterialIcon name="chevron_right" size={16} />
                            </Link>
                        </div>

                        <div className="max-h-[380px] overflow-y-auto divide-y divide-outline-variant/5">
                            {isLoadingMessages ? (
                                <div className="p-8 flex flex-col items-center justify-center text-on-surface-variant/60">
                                    <MaterialIcon name="progress_activity" className="animate-spin text-primary mb-2" size={24} />
                                    <span className="text-xs">Đang tải tin nhắn...</span>
                                </div>
                            ) : conversations.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-3 text-on-surface-variant">
                                        <MaterialIcon name="chat" size={24} />
                                    </div>
                                    <p className="text-sm font-medium text-on-surface">Chưa có tin nhắn nào</p>
                                    <p className="text-xs text-on-surface-variant mt-1">Bắt đầu trò chuyện với bạn bè ngay!</p>
                                </div>
                            ) : (
                                conversations.map((conv) => {
                                    const isGroup = conv.isGroup || conv.type === "group";
                                    let avatar = "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix";
                                    let name = "Cuộc trò chuyện";
                                    let partnerId = null;

                                    if (isGroup) {
                                        name = conv.groupRef?.name || conv.name || "Nhóm trò chuyện";
                                        avatar = conv.groupRef?.avatarUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${conv.id || conv._id}`;
                                    } else {
                                        const otherMember = conv.participants?.find(p => (p.userId || p.id) !== user?.id);
                                        if (otherMember) {
                                            name = otherMember.displayName || otherMember.name || "Bạn bè";
                                            avatar = otherMember.avatarUrl || avatar;
                                            partnerId = otherMember.userId || otherMember.id;
                                        }
                                    }

                                    const isOnline = partnerId && (Array.isArray(onlineUsers) ? onlineUsers.includes(partnerId) : Boolean(onlineUsers?.[partnerId]));
                                    const isUnread = conv.unreadCount > 0 || conv.isUnread || 
                                        (conv.lastMessage && !conv.lastMessage.isRead && (conv.lastMessage.senderId || conv.lastMessage.sender) !== user?.id);

                                    return (
                                        <div
                                            key={conv.id || conv._id}
                                            onClick={() => handleSelectConversation(conv)}
                                            className={`p-3.5 hover:bg-surface-container-low/60 transition cursor-pointer flex items-center space-x-3 group relative ${
                                                isUnread ? "bg-primary-container/10" : ""
                                            }`}
                                        >
                                            <div className="relative shrink-0">
                                                <img 
                                                    src={avatar} 
                                                    className="w-11 h-11 rounded-full object-cover border border-outline-variant/20" 
                                                    alt="Avatar" 
                                                />
                                                {isOnline && (
                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-secondary border-2 border-surface rounded-full"></span>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className={`text-sm truncate ${isUnread ? "font-bold text-on-surface" : "font-semibold text-on-surface group-hover:text-primary"}`}>
                                                        {name}
                                                    </p>
                                                    <span className={`text-[10px] shrink-0 ml-2 ${isUnread ? "font-bold text-primary" : "text-on-surface-variant/60"}`}>
                                                        {formatTimeAgo(conv.updatedAt || conv.lastMessageAt)}
                                                    </span>
                                                </div>
                                                <p className={`text-xs truncate mt-0.5 ${isUnread ? "font-bold text-on-surface" : "text-on-surface-variant"}`}>
                                                    {conv.lastMessage?.content || "Nhấn để bắt đầu trò chuyện"}
                                                </p>
                                            </div>

                                            {isUnread && (
                                                <span className="w-2.5 h-2.5 bg-primary rounded-full shrink-0 ml-1 shadow-sm"></span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 3. ICON THÔNG BÁO */}
            <div className="relative">
                <button
                    onClick={() => toggleDropdown("notifications")}
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                        activeDropdown === "notifications"
                            ? "bg-primary text-on-primary shadow-lg scale-105"
                            : "bg-surface-container-low/60 hover:bg-surface-container-high/60 text-on-surface-variant hover:text-primary border border-outline-variant/10 active:scale-95"
                    }`}
                    title="Thông báo"
                >
                    <MaterialIcon name="notifications_none" size={20} filled={activeDropdown === "notifications"} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-error text-on-error text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-md">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>

                {/* Dropdown Danh Sách Thông Báo */}
                {activeDropdown === "notifications" && (
                    <div className="absolute right-0 mt-3 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/10 rounded-2xl shadow-[0_20px_60px_rgba(142,148,242,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] z-50 overflow-hidden animate-slide-up">
                        <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/40">
                            <div className="flex items-center space-x-2">
                                <MaterialIcon name="notifications" className="text-primary" size={18} />
                                <h3 className="font-bold text-on-surface text-sm">Thông báo</h3>
                                {unreadCount > 0 && (
                                    <span className="bg-error-container/40 text-on-error-container text-xs font-semibold px-2 py-0.5 rounded-full">
                                        {unreadCount} chưa đọc
                                    </span>
                                )}
                            </div>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllNotificationsRead}
                                    className="text-xs text-primary hover:underline font-medium flex items-center cursor-pointer"
                                >
                                    <MaterialIcon name="done_all" size={16} className="mr-1" /> Đọc tất cả
                                </button>
                            )}
                        </div>

                        <div className="max-h-[380px] overflow-y-auto divide-y divide-outline-variant/5">
                            {isLoadingNotifications ? (
                                <div className="p-8 flex flex-col items-center justify-center text-on-surface-variant/60">
                                    <MaterialIcon name="progress_activity" className="animate-spin text-primary mb-2" size={24} />
                                    <span className="text-xs">Đang tải thông báo...</span>
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-3 text-on-surface-variant">
                                        <MaterialIcon name="notifications_off" size={24} />
                                    </div>
                                    <p className="text-sm font-medium text-on-surface">Chưa có thông báo nào</p>
                                    <p className="text-xs text-on-surface-variant mt-1">Các hoạt động tương tác mới sẽ xuất hiện ở đây.</p>
                                </div>
                            ) : (
                                notifications.map((notif) => {
                                    const fromUser = notif.fromUser || {};
                                    return (
                                        <div
                                            key={notif.id}
                                            onClick={() => handleNotificationClick(notif)}
                                            className={`p-3.5 hover:bg-surface-container-low/60 transition cursor-pointer flex items-start space-x-3 group relative ${
                                                !notif.isRead ? "bg-primary-container/10" : ""
                                            }`}
                                        >
                                            <div className="relative shrink-0">
                                                <img 
                                                    src={fromUser.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"} 
                                                    className="w-10 h-10 rounded-full object-cover border border-outline-variant/20" 
                                                    alt="Avatar" 
                                                />
                                                <div className="absolute -bottom-1 -right-1 bg-surface rounded-full p-0.5 shadow-sm border border-outline-variant/10">
                                                    {getNotificationIcon(notif.type)}
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs line-clamp-2 ${!notif.isRead ? "font-bold text-on-surface" : "font-normal text-on-surface-variant"}`}>
                                                    {notif.message}
                                                </p>
                                                <span className="text-[10px] text-primary font-medium mt-1 inline-block">
                                                    {formatRelativeTime(notif.createdAt)}
                                                </span>
                                            </div>

                                            {!notif.isRead && (
                                                <span className="w-2.5 h-2.5 bg-primary rounded-full shrink-0 mt-1.5 shadow-sm"></span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 4. CHUYỂN ĐỔI CHẾ ĐỘ SÁNG / TỐI */}
            {setIsDark && (
                <button
                    onClick={() => setIsDark(!isDark)}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-low/60 hover:bg-surface-container-high/60 text-on-surface-variant hover:text-primary transition-all duration-200 cursor-pointer border border-outline-variant/10 active:scale-95"
                    title={isDark ? "Chuyển sang Chế độ Sáng" : "Chuyển sang Chế độ Tối"}
                >
                    <MaterialIcon name={isDark ? "light_mode" : "dark_mode"} size={20} />
                </button>
            )}

            {/* 5. TRUY CẬP NHANH PROFILE & ĐĂNG XUẤT */}
            <div className="flex items-center space-x-2 pl-2 border-l border-outline-variant/10">
                <Link
                    to={`/profile/${user?.id}`}
                    className="flex items-center space-x-2.5 p-1.5 pr-3 rounded-full bg-surface-container-low/60 hover:bg-surface-container-high/60 border border-outline-variant/10 transition group cursor-pointer"
                    title="Trang cá nhân"
                >
                    <img
                        src={user?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full border border-outline-variant/20 object-cover ring-2 ring-primary/10 shrink-0"
                    />
                    <span className="text-xs font-semibold text-on-surface group-hover:text-primary transition truncate max-w-[120px]">
                        {user?.displayName}
                    </span>
                </Link>

                <button
                    onClick={async () => {
                        await logout();
                        navigate("/login");
                    }}
                    className="p-2 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/30 transition cursor-pointer border border-outline-variant/10"
                    title="Đăng xuất"
                >
                    <MaterialIcon name="logout" size={18} />
                </button>
            </div>
        </div>
    );
};

export default TopHeaderNav;
