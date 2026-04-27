const pool = require('./db/pool');

// Track online users: userId -> Set<socketId>
const onlineUsers = new Map();
// Track typing: conversationId -> Set<userId>
const typingUsers = new Map();

function setupSocket(io) {
  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Update online status in DB
    pool.query('UPDATE users SET is_online = true WHERE id = $1', [userId]);

    // Broadcast online status
    io.emit('user:online', { userId, isOnline: true });

    // Join user's conversation rooms
    pool.query(
      'SELECT conversation_id FROM conversation_members WHERE user_id = $1',
      [userId]
    ).then(result => {
      result.rows.forEach(row => {
        socket.join(`conv:${row.conversation_id}`);
      });
    });

    // Send message
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, content, type = 'text', fileUrl, fileName, fileSize, replyToId, voiceTranscript } = data;

        const result = await pool.query(
          `INSERT INTO messages (conversation_id, sender_id, content, type, file_url, file_name, file_size, reply_to_id, voice_transcript)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [conversationId, userId, content, type, fileUrl, fileName, fileSize, replyToId || null, voiceTranscript]
        );

        const msg = result.rows[0];

        // Get sender info
        const sender = await pool.query(
          'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
          [userId]
        );
        msg.sender = sender.rows[0];
        msg.reactions = [];
        msg.is_favorited = false;

        // Get reply info if exists
        if (replyToId) {
          const reply = await pool.query(
            `SELECT m.id, m.content, m.sender_id, u.display_name as sender_display_name
             FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = $1`,
            [replyToId]
          );
          if (reply.rows[0]) {
            msg.reply_to = {
              id: reply.rows[0].id,
              content: reply.rows[0].content,
              sender_id: reply.rows[0].sender_id,
              sender: { display_name: reply.rows[0].sender_display_name }
            };
          }
        }

        // Create delivery status for all members except sender
        const members = await pool.query(
          'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2',
          [conversationId, userId]
        );
        for (const member of members.rows) {
          await pool.query(
            'INSERT INTO message_status (message_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [msg.id, member.user_id, 'delivered']
          );
        }

        io.to(`conv:${conversationId}`).emit('message:new', msg);

        // Send notification to offline conversation members
        members.rows.forEach(member => {
          if (member.user_id !== userId) {
            io.to(`conv:${conversationId}`).emit('notification', {
              type: 'new_message',
              conversationId,
              message: msg
            });
          }
        });
      } catch (err) {
        console.error('Send message error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Edit message
    socket.on('message:edit', async (data) => {
      try {
        const { messageId, content } = data;
        const result = await pool.query(
          `UPDATE messages SET content = $1, is_edited = true, updated_at = NOW()
           WHERE id = $2 AND sender_id = $3 RETURNING *`,
          [content, messageId, userId]
        );
        if (result.rows[0]) {
          const msg = result.rows[0];
          io.to(`conv:${msg.conversation_id}`).emit('message:edited', msg);
        }
      } catch (err) {
        console.error('Edit message error:', err);
      }
    });

    // Delete message
    socket.on('message:delete', async (data) => {
      try {
        const { messageId } = data;
        const result = await pool.query(
          'DELETE FROM messages WHERE id = $1 AND sender_id = $2 RETURNING *',
          [messageId, userId]
        );
        if (result.rows[0]) {
          io.to(`conv:${result.rows[0].conversation_id}`).emit('message:deleted', {
            messageId,
            conversationId: result.rows[0].conversation_id
          });
        }
      } catch (err) {
        console.error('Delete message error:', err);
      }
    });

    // Typing indicator
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', { userId, conversationId });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', { userId, conversationId });
    });

    // Mark messages as read
    socket.on('messages:read', async ({ conversationId }) => {
      try {
        await pool.query(
          `INSERT INTO message_status (message_id, user_id, status)
           SELECT m.id, $2, 'read' FROM messages m
           WHERE m.conversation_id = $1 AND m.sender_id != $2
           ON CONFLICT (message_id, user_id) DO UPDATE SET status = 'read', updated_at = NOW()`,
          [conversationId, userId]
        );
        socket.to(`conv:${conversationId}`).emit('messages:read', { userId, conversationId });
      } catch (err) {
        console.error('Mark read error:', err);
      }
    });

    // Reaction
    socket.on('message:reaction', async ({ messageId, emoji }) => {
      try {
        const existing = await pool.query(
          'SELECT id FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
          [messageId, userId, emoji]
        );

        let action;
        if (existing.rows.length > 0) {
          await pool.query('DELETE FROM reactions WHERE id = $1', [existing.rows[0].id]);
          action = 'removed';
        } else {
          await pool.query(
            'INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
            [messageId, userId, emoji]
          );
          action = 'added';
        }

        // Get message to find conversation
        const msg = await pool.query('SELECT conversation_id FROM messages WHERE id = $1', [messageId]);
        if (msg.rows[0]) {
          // Get all reactions for this message
          const reactions = await pool.query(
            `SELECT r.emoji, r.user_id, u.username
             FROM reactions r JOIN users u ON u.id = r.user_id
             WHERE r.message_id = $1`,
            [messageId]
          );
          io.to(`conv:${msg.rows[0].conversation_id}`).emit('message:reaction', {
            messageId,
            reactions: reactions.rows,
            action,
            userId,
            emoji
          });
        }
      } catch (err) {
        console.error('Reaction error:', err);
      }
    });

    // Pin message
    socket.on('message:pin', async ({ messageId }) => {
      try {
        const msg = await pool.query('SELECT * FROM messages WHERE id = $1', [messageId]);
        if (msg.rows[0]) {
          const newPinned = !msg.rows[0].is_pinned;
          await pool.query('UPDATE messages SET is_pinned = $1 WHERE id = $2', [newPinned, messageId]);
          
          if (newPinned) {
            await pool.query('UPDATE conversations SET pinned_message_id = $1 WHERE id = $2',
              [messageId, msg.rows[0].conversation_id]);
          } else {
            await pool.query('UPDATE conversations SET pinned_message_id = NULL WHERE id = $1',
              [msg.rows[0].conversation_id]);
          }

          io.to(`conv:${msg.rows[0].conversation_id}`).emit('message:pinned', {
            messageId,
            pinned: newPinned,
            conversationId: msg.rows[0].conversation_id
          });
        }
      } catch (err) {
        console.error('Pin error:', err);
      }
    });

    // WebRTC signaling
    socket.on('call:initiate', ({ targetUserId, conversationId, callType }) => {
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:incoming', {
            callerId: userId,
            conversationId,
            callType
          });
        });
      }
    });

    socket.on('call:accept', ({ callerId }) => {
      const callerSockets = onlineUsers.get(callerId);
      if (callerSockets) {
        callerSockets.forEach(sid => {
          io.to(sid).emit('call:accepted', { userId });
        });
      }
    });

    socket.on('call:reject', ({ callerId }) => {
      const callerSockets = onlineUsers.get(callerId);
      if (callerSockets) {
        callerSockets.forEach(sid => {
          io.to(sid).emit('call:rejected', { userId });
        });
      }
    });

    socket.on('call:end', ({ targetUserId }) => {
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:ended', { userId });
        });
      }
    });

    socket.on('webrtc:offer', ({ targetUserId, offer }) => {
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('webrtc:offer', { userId, offer });
        });
      }
    });

    socket.on('webrtc:answer', ({ targetUserId, answer }) => {
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('webrtc:answer', { userId, answer });
        });
      }
    });

    socket.on('webrtc:ice-candidate', ({ targetUserId, candidate }) => {
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('webrtc:ice-candidate', { userId, candidate });
        });
      }
    });

    // Join conversation room
    socket.on('conversation:join', ({ conversationId }) => {
      socket.join(`conv:${conversationId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          pool.query('UPDATE users SET is_online = false, last_seen = NOW() WHERE id = $1', [userId]);
          io.emit('user:online', { userId, isOnline: false });
        }
      }
      console.log(`User disconnected: ${userId}`);
    });
  });
}

module.exports = { setupSocket };
