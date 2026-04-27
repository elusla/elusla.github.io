const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get messages for a conversation
router.get('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify membership
    const member = await pool.query(
      'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.userId]
    );
    if (member.rows.length === 0) return res.status(403).json({ error: 'Not a member' });

    let query = `
      SELECT m.*, 
        json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url) as sender,
        COALESCE(
          (SELECT json_agg(json_build_object('emoji', r.emoji, 'user_id', r.user_id, 'username', ru.username))
           FROM reactions r JOIN users ru ON ru.id = r.user_id WHERE r.message_id = m.id
          ), '[]'::json
        ) as reactions,
        (SELECT json_build_object('id', rm.id, 'content', rm.content, 'sender_id', rm.sender_id,
           'sender', json_build_object('display_name', rmu.display_name))
         FROM messages rm JOIN users rmu ON rmu.id = rm.sender_id
         WHERE rm.id = m.reply_to_id
        ) as reply_to,
        EXISTS(SELECT 1 FROM favorites f WHERE f.message_id = m.id AND f.user_id = $2) as is_favorited
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = $1
    `;
    const params = [conversationId, req.userId];

    if (before) {
      query += ` AND m.created_at < $3`;
      params.push(before);
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    // Mark messages as read
    await pool.query(
      `INSERT INTO message_status (message_id, user_id, status)
       SELECT m.id, $2, 'read' FROM messages m
       WHERE m.conversation_id = $1 AND m.sender_id != $2
       ON CONFLICT (message_id, user_id) DO UPDATE SET status = 'read', updated_at = NOW()`,
      [conversationId, req.userId]
    );

    res.json(result.rows.reverse());
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit message
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    const result = await pool.query(
      `UPDATE messages SET content = $1, is_edited = true, updated_at = NOW()
       WHERE id = $2 AND sender_id = $3 RETURNING *`,
      [content, req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete message
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM messages WHERE id = $1 AND sender_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
    res.json({ success: true, message: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle reaction
router.post('/:id/reaction', authMiddleware, async (req, res) => {
  try {
    const { emoji } = req.body;
    const existing = await pool.query(
      'SELECT id FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [req.params.id, req.userId, emoji]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM reactions WHERE id = $1', [existing.rows[0].id]);
      return res.json({ action: 'removed' });
    }

    await pool.query(
      'INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
      [req.params.id, req.userId, emoji]
    );
    res.json({ action: 'added' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle pin
router.post('/:id/pin', authMiddleware, async (req, res) => {
  try {
    const msg = await pool.query('SELECT * FROM messages WHERE id = $1', [req.params.id]);
    if (msg.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const newPinned = !msg.rows[0].is_pinned;
    await pool.query('UPDATE messages SET is_pinned = $1 WHERE id = $2', [newPinned, req.params.id]);

    if (newPinned) {
      await pool.query('UPDATE conversations SET pinned_message_id = $1 WHERE id = $2',
        [req.params.id, msg.rows[0].conversation_id]);
    } else {
      await pool.query('UPDATE conversations SET pinned_message_id = NULL WHERE id = $1',
        [msg.rows[0].conversation_id]);
    }

    res.json({ pinned: newPinned });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle favorite
router.post('/:id/favorite', authMiddleware, async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT 1 FROM favorites WHERE user_id = $1 AND message_id = $2',
      [req.userId, req.params.id]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM favorites WHERE user_id = $1 AND message_id = $2',
        [req.userId, req.params.id]);
      return res.json({ action: 'removed' });
    }

    await pool.query('INSERT INTO favorites (user_id, message_id) VALUES ($1, $2)',
      [req.userId, req.params.id]);
    res.json({ action: 'added' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get favorites
router.get('/favorites/all', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, 
        json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url) as sender
       FROM favorites f
       JOIN messages m ON m.id = f.message_id
       JOIN users u ON u.id = m.sender_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
