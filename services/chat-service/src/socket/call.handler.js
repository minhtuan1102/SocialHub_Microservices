import { redisClient } from '../config/redis.js';

/**
 * Register WebRTC Call Signaling Socket.IO event handlers
 * @param {import('socket.io').Server} io 
 * @param {import('socket.io').Socket} socket 
 */
export default (io, socket) => {
  const currentUserId = socket.userId;

  // 1. Initiating a Call (1-on-1 or Group)
  socket.on('call:initiate', async (payload) => {
    try {
      const { targetUserId, targetUserIds, groupId, groupName, groupAvatar, callerName, callerAvatar, callType = 'video' } = payload;

      // Xử lý cuộc gọi nhóm (Group Call)
      if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
        console.log(`📞 [CALL] User ${currentUserId} (${socket.displayName}) initiating group ${callType} call for group "${groupName || groupId}" to members:`, targetUserIds);

        let onlineCount = 0;
        for (const memberId of targetUserIds) {
          if (String(memberId) === String(currentUserId)) continue;

          const memberSockets = await io.in(`user:${memberId}`).fetchSockets();
          if (memberSockets.length > 0) {
            onlineCount++;
            io.to(`user:${memberId}`).emit('call:incoming', {
              callerId: currentUserId,
              callerName: callerName || socket.displayName,
              callerAvatar: callerAvatar || socket.avatarUrl,
              callType,
              groupId,
              groupName,
              groupAvatar,
              isGroup: true
            });
          }
        }

        if (onlineCount === 0) {
          console.log(`⚠️ [CALL] No online members found for group call ${groupId || ''}`);
          return socket.emit('call:rejected', {
            groupId,
            reason: 'all_offline'
          });
        }
        return;
      }

      // Xử lý cuộc gọi 1-1 (1-on-1 Call)
      if (!targetUserId) {
        return socket.emit('error', { message: 'targetUserId or targetUserIds is required' });
      }

      console.log(`📞 [CALL] User ${currentUserId} (${socket.displayName}) initiating ${callType} call to ${targetUserId}`);

      const targetSockets = await io.in(`user:${targetUserId}`).fetchSockets();
      const isOnline = targetSockets.length > 0;

      if (!isOnline) {
        console.log(`⚠️ [CALL] Target user ${targetUserId} is offline (Active Sockets = 0)`);
        return socket.emit('call:rejected', {
          calleeId: targetUserId,
          reason: 'offline'
        });
      }

      io.to(`user:${targetUserId}`).emit('call:incoming', {
        callerId: currentUserId,
        callerName: callerName || socket.displayName,
        callerAvatar: callerAvatar || socket.avatarUrl,
        callType
      });

    } catch (error) {
      console.error('❌ Error handling call:initiate:', error.message);
      socket.emit('error', { message: 'Failed to initiate call' });
    }
  });

  // 2. Accept Call
  socket.on('call:accept', (payload) => {
    try {
      const { callerId, calleeName, calleeAvatar } = payload;
      console.log(`📞 [CALL] User ${currentUserId} accepted call from ${callerId}`);

      io.to(`user:${callerId}`).emit('call:accepted', {
        calleeId: currentUserId,
        calleeName: calleeName || socket.displayName,
        calleeAvatar: calleeAvatar || socket.avatarUrl
      });
    } catch (error) {
      console.error('❌ Error handling call:accept:', error.message);
    }
  });

  // 3. Reject Call
  socket.on('call:reject', (payload) => {
    try {
      const { callerId, reason = 'rejected' } = payload;
      console.log(`📞 [CALL] User ${currentUserId} rejected call from ${callerId}, reason=${reason}`);

      io.to(`user:${callerId}`).emit('call:rejected', {
        calleeId: currentUserId,
        reason
      });
    } catch (error) {
      console.error('❌ Error handling call:reject:', error.message);
    }
  });

  // 4. End Call
  socket.on('call:end', (payload) => {
    try {
      const { targetUserId } = payload;
      console.log(`📞 [CALL] User ${currentUserId} ended call with ${targetUserId}`);

      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('call:ended', {
          userId: currentUserId
        });
      }
    } catch (error) {
      console.error('❌ Error handling call:end:', error.message);
    }
  });

  // 5. WebRTC Signaling: Forward SDP Offer
  socket.on('webrtc:offer', (payload) => {
    try {
      const { targetUserId, sdp } = payload;
      if (!targetUserId || !sdp) return;

      io.to(`user:${targetUserId}`).emit('webrtc:offer', {
        senderId: currentUserId,
        sdp
      });
    } catch (error) {
      console.error('❌ Error handling webrtc:offer:', error.message);
    }
  });

  // 6. WebRTC Signaling: Forward SDP Answer
  socket.on('webrtc:answer', (payload) => {
    try {
      const { targetUserId, sdp } = payload;
      if (!targetUserId || !sdp) return;

      io.to(`user:${targetUserId}`).emit('webrtc:answer', {
        senderId: currentUserId,
        sdp
      });
    } catch (error) {
      console.error('❌ Error handling webrtc:answer:', error.message);
    }
  });

  // 7. WebRTC Signaling: Forward ICE Candidate
  socket.on('webrtc:ice-candidate', (payload) => {
    try {
      const { targetUserId, candidate } = payload;
      if (!targetUserId || !candidate) return;

      io.to(`user:${targetUserId}`).emit('webrtc:ice-candidate', {
        senderId: currentUserId,
        candidate
      });
    } catch (error) {
      console.error('❌ Error handling webrtc:ice-candidate:', error.message);
    }
  });

  // 8. Group Call Room: Join Room (Zoom / Google Meet Mesh Topology)
  socket.on('group-call:join', async (payload) => {
    try {
      const { groupId } = payload;
      if (!groupId) return;

      const roomName = `group-call:${groupId}`;
      
      // Lấy danh sách các socket đang tham gia phòng cuộc gọi nhóm này
      const existingSockets = await io.in(roomName).fetchSockets();
      const existingParticipants = existingSockets
        .filter(s => String(s.userId) !== String(currentUserId))
        .map(s => ({
          userId: s.userId,
          displayName: s.displayName,
          avatarUrl: s.avatarUrl
        }));

      socket.join(roomName);
      console.log(`👥 [GROUP CALL] User ${currentUserId} (${socket.displayName}) joined meeting room ${roomName}. Existing peers count:`, existingParticipants.length);

      // Gửi danh sách thành viên hiện có trong phòng cho người mới vào
      socket.emit('group-call:joined-room', {
        groupId,
        existingParticipants
      });

      // Thông báo cho các thành viên hiện có trong phòng biết có người mới gia nhập
      socket.to(roomName).emit('group-call:user-joined', {
        groupId,
        userId: currentUserId,
        displayName: socket.displayName,
        avatarUrl: socket.avatarUrl
      });
    } catch (error) {
      console.error('❌ Error handling group-call:join:', error.message);
    }
  });

  // 9. Group Call Room: Leave Room
  socket.on('group-call:leave', async (payload) => {
    try {
      const { groupId } = payload;
      if (!groupId) return;

      const roomName = `group-call:${groupId}`;
      socket.leave(roomName);
      console.log(`👥 [GROUP CALL] User ${currentUserId} left meeting room ${roomName}`);

      socket.to(roomName).emit('group-call:user-left', {
        groupId,
        userId: currentUserId
      });
    } catch (error) {
      console.error('❌ Error handling group-call:leave:', error.message);
    }
  });
};
