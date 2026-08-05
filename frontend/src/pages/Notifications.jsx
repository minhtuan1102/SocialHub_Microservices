import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useSocket } from "../context/SocketContext";
import MaterialIcon from "../components/MaterialIcon";

const Notifications = () => {
    const { setUnreadCount } = useSocket();
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchNotifications = async () => {
        setIsLoading(true);
        try {
            const res = await api.get("/notifications");
            if (res.data && res.data.success) {
                setNotifications(res.data.data || []);
            }
        } catch (error) {
            console.error("❌ Lỗi khi tải danh sách thông báo:", error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    useEffect(() => {
        const handleNewNotification = (e) => {
            const newNotif = e.detail;
            setNotifications(prev => {
                if (prev.some(n => n.id === newNotif.id)) return prev;
                return [newNotif, ...prev];
            });
        };

        window.addEventListener("notification-received", handleNewNotification);
        return () => {
            window.removeEventListener("notification-received", handleNewNotification);
        };
    }, []);

    const handleMarkAsRead = async (notification) => {
        if (notification.isRead) {
            handleRedirect(notification);
            return;
        }

        try {
            const res = await api.put(`/notifications/${notification.id}/read`);
            if (res.data && res.data.success) {
                setNotifications(prev =>
                    prev.map(n => (n.id === notification.id ? { ...n, isRead: true } : n))
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
                handleRedirect(notification);
            }
        } catch (error) {
            console.error("❌ Lỗi khi đánh dấu đã đọc:", error);
            handleRedirect(notification);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const res = await api.put("/notifications/read-all");
            if (res.data && res.data.success) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
            }
        } catch (error) {
            console.error("❌ Lỗi khi đánh dấu đọc tất cả:", error);
        }
    };

    const handleRedirect = (notif) => {
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
        } else {
            navigate("/");
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case "post_liked":
                return <MaterialIcon name="favorite" filled className="text-error" size={18} />;
            case "post_commented":
                return <MaterialIcon name="chat_bubble" filled className="text-primary" size={18} />;
            case "post_shared":
                return <MaterialIcon name="share" className="text-secondary" size={18} />;
            case "friend_request":
                return <MaterialIcon name="person_add" className="text-secondary" size={18} />;
            case "friend_accepted":
                return <MaterialIcon name="person_check" className="text-secondary" size={18} />;
            default:
                return <MaterialIcon name="notifications" className="text-primary" size={18} />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header thông báo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-outline-variant/10 pb-4 gap-3 sm:gap-0">
                <div>
                    <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight flex items-center gap-3">
                        <MaterialIcon name="notifications" size={36} />
                        <span>Thông báo</span>
                    </h1>
                    <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">Nơi lưu lại các lượt tương tác của mọi người với bạn.</p>
                </div>
                
                {notifications.some(n => !n.isRead) && (
                    <button
                        onClick={handleMarkAllAsRead}
                        className="flex items-center justify-center space-x-2 px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/10 rounded-xl text-xs font-semibold text-on-surface-variant transition cursor-pointer shadow-sm self-start sm:self-auto"
                    >
                        <MaterialIcon name="done_all" size={16} />
                        <span>Đánh dấu đọc tất cả</span>
                    </button>
                )}
            </div>

            {/* Danh sách thông báo */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <MaterialIcon name="progress_activity" size={32} className="text-primary animate-spin" />
                </div>
            ) : notifications.length > 0 ? (
                <div className="space-y-3">
                    {notifications.map((notif) => (
                        <div
                            key={notif.id}
                            onClick={() => handleMarkAsRead(notif)}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition duration-200 cursor-pointer ${
                                notif.isRead
                                    ? "bg-surface-container-low/60 dark:bg-surface-container-high/40 border-outline-variant/10 text-on-surface-variant"
                                    : "bg-primary-container/10 border-primary/20 shadow-md text-on-surface"
                            }`}
                        >
                            <div className="flex items-center space-x-4 min-w-0 flex-1">
                                <div className="relative shrink-0">
                                    <img
                                        src={notif.fromUser?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                        alt="Avatar"
                                        className="w-12 h-12 rounded-full border border-outline-variant/20 object-cover"
                                    />
                                    <div className="absolute -bottom-1 -right-1 p-1 bg-surface-container-lowest dark:bg-surface-container-high rounded-full border border-outline-variant/10 shadow-sm">
                                        {getIcon(notif.type)}
                                    </div>
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs sm:text-sm font-medium leading-snug break-words">
                                        {(() => {
                                            const displayName = notif.fromUser?.displayName;
                                            const msg = notif.message || "";
                                            if (displayName && msg.startsWith(displayName)) {
                                                return (
                                                    <>
                                                        <strong className="font-bold text-on-surface">{displayName}</strong>
                                                        {msg.slice(displayName.length)}
                                                    </>
                                                );
                                            }
                                            return (
                                                <>
                                                    <strong className="font-bold text-on-surface">{displayName || "Một người dùng"}</strong>{" "}
                                                    {msg}
                                                </>
                                            );
                                        })()}
                                    </p>
                                    <p className="text-[10px] sm:text-xs text-on-surface-variant/60 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                                </div>
                            </div>

                            {!notif.isRead && (
                                <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-md ml-2"></div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-surface-container-low/60 dark:bg-surface-container-high/60 backdrop-blur-2xl border border-outline-variant/10 rounded-3xl p-8 shadow-sm">
                    <MaterialIcon name="notifications_off" size={48} className="text-on-surface-variant/40 mx-auto mb-4" />
                    <p className="font-headline-md text-lg text-on-surface">Hộp thư thông báo của bạn trống</p>
                    <p className="font-body-md text-sm text-on-surface-variant mt-1">Khi có người tương tác, kết bạn hoặc bình luận bài đăng của bạn, chúng sẽ xuất hiện ở đây.</p>
                </div>
            )}
        </div>
    );
};

export default Notifications;
