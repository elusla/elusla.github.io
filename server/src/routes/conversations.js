const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all conversations for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, 
        CASE WHEN c.type = 'dm' THEN (
          SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'is_online', u.is_online, 'last_seen', u.last_seen)
          FROM conversation_members cm2 JOIN users u ON u.id = cm2.user_id
          WHERE cm2.conversation_id = c.id AND cm2.user_id != $1
          LIMIT 1
        ) ELSE NULL END as other_user,
        (SELECT json_build_object('id', m.id, 'content', m.content, 'type', m.type, 'sender_id', m.sender_id, 'created_at', m.created_at)
         FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
        ) as last_message,
        (SELECT COUNT(*)::int FROM messages m 
         WHERE m.conversation_id = c.id 
         AND m.sender_id != $1
         AND NOT EXISTS (
           SELECT 1 FROM message_status ms WHERE ms.message_id = m.id AND ms.user_id = $1 AND ms.status = 'read'
         )
        ) as unread_count,
        (SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'is_online', u.is_online))
         FROM conversation_members cm3 JOIN users u ON u.id = cm3.user_id WHERE cm3.conversation_id = c.id
        ) as members
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id
       WHERE cm.user_id = $1
       ORDER BY c.updated_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create DM conversation
router.post('/dm', authMiddleware, async (req, res) => {
  try {
    const { userId: otherUserId } = req.body;
    
    // Check if DM already exists
    const existing = await pool.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
       JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2
       WHERE c.type = 'dm'`,
      [req.userId, otherUserId]
    );

    if (existing.rows.length > 0) {
      // Return existing conversation
      const conv = await getConversationById(existing.rows[0].id, req.userId);
      return res.json(conv);
    }

    // Create new DM
    const conv = await pool.query(
      `INSERT INTO conversations (type, created_by) VALUES ('dm', $1) RETURNING *`,
      [req.userId]
    );

    await pool.query(
      'INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, $3), ($1, $4, $3)',
      [conv.rows[0].id, req.userId, 'member', otherUserId]
    );

    const fullConv = await getConversationById(conv.rows[0].id, req.userId);
    res.json(fullConv);
  } catch (err) {
    console.error('Create DM error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create group conversation
router.post('/group', authMiddleware, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !memberIds?.length) {
      return res.status(400).json({ error: 'Name and members required' });
    }

    const conv = await pool.query(
      `INSERT INTO conversations (type, name, created_by) VALUES ('group', $1, $2) RETURNING *`,
      [name, req.userId]
    );

    const allMembers = [req.userId, ...memberIds];
    for (const memberId of allMembers) {
      const role = memberId === req.userId ? 'admin' : 'member';
      await pool.query(
        'INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, $3)',
        [conv.rows[0].id, memberId, role]
      );
    }

    const fullConv = await getConversationById(conv.rows[0].id, req.userId);
    res.json(fullConv);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single conversation
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const conv = await getConversationById(req.params.id, req.userId);
    if (!conv) return res.status(404).json({ error: 'Not found' });
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

async function getConversationById(convId, userId) {
  const result = await pool.query(
    `SELECT c.*, 
      CASE WHEN c.type = 'dm' THEN (
        SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'is_online', u.is_online, 'last_seen', u.last_seen)
        FROM conversation_members cm2 JOIN users u ON u.id = cm2.user_id
        WHERE cm2.conversation_id = c.id AND cm2.user_id != $2
        LIMIT 1
      ) ELSE NULL END as other_user,
      (SELECT json_build_object('id', m.id, 'content', m.content, 'type', m.type, 'sender_id', m.sender_id, 'created_at', m.created_at)
       FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
      ) as last_message,
      (SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'is_online', u.is_online))
       FROM conversation_members cm3 JOIN users u ON u.id = cm3.user_id WHERE cm3.conversation_id = c.id
      ) as members
     FROM conversations c
     JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $2
     WHERE c.id = $1`,
    [convId, userId]
  );
  return result.rows[0] || null;
}

module.exports = router;
