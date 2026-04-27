'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Conversation } from './ChatLayout';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { Phone, Video, MoreVertical, Pin, Users } from 'lucide-react';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  voice_transcript: string | null;
  reply_to: any;
  reply_to_id: string | null;
  is_edited: boolean;
  is_pinned: boolean;
  is_favorited: boolean;
  reactions: any[];
  sender: any;
  created_at: string;
}

interface Props {
  conversation: Conversation;
  onRefreshConversations: () => void;
  onStartCall: (type: 'audio' | 'video') => void;
}

export default function ChatWindow({ conversation, onRefreshConversations, onStartCall }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getMessages(conversation.id);
      setMessages(data);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
    setLoading(false);
  }, [conversation.id]);

  useEffect(() => {
    loadMessages();
    setReplyTo(null);
    setTypingUsers(new Set());
  }, [conversation.id, loadMessages]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNew = (msg: Message) => {
      if (msg.conversation_id === conversation.id) {
        setMessages(prev => [...prev, msg]);
        setTimeout(scrollToBottom, 50);
        socket.emit('messages:read', { conversationId: conversation.id });
      }
    };

    const handleEdited = (msg: any) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content, is_edited: true } : m));
    };

    const handleDeleted = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    };

    const handleReaction = ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    };

    const handlePinned = ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: pinned } : m));
    };

    const handleTypingStart = ({ userId, conversationId }: any) => {
      if (conversationId === conversation.id && userId !== user?.id) {
        setTypingUsers(prev => new Set([...prev, userId]));
      }
    };

    const handleTypingStop = ({ userId, conversationId }: any) => {
      if (conversationId === conversation.id) {
        setTypingUsers(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    };

    const handleRead = ({ userId: readerId, conversationId }: any) => {
      if (conversationId === conversation.id) {
        // Could update message delivery status UI here
      }
    };

    socket.on('message:new', handleNew);
    socket.on('message:edited', handleEdited);
    socket.on('message:deleted', handleDeleted);
    socket.on('message:reaction', handleReaction);
    socket.on('message:pinned', handlePinned);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('messages:read', handleRead);

    return () => {
      socket.off('message:new', handleNew);
      socket.off('message:edited', handleEdited);
      socket.off('message:deleted', handleDeleted);
      socket.off('message:reaction', handleReaction);
      socket.off('message:pinned', handlePinned);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('messages:read', handleRead);
    };
  }, [conversation.id, user?.id]);

  const handleSendMessage = (data: {
    content?: string;
    type?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    voiceTranscript?: string;
  }) => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('message:send', {
      conversationId: conversation.id,
      content: data.content || '',
      type: data.type || 'text',
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      replyToId: replyTo?.id,
      voiceTranscript: data.voiceTranscript,
    });
    setReplyTo(null);
  };

  const conversationName = conversation.type === 'group'
    ? conversation.name
    : conversation.other_user?.display_name || conversation.other_user?.username;

  const otherOnline = conversation.type === 'dm' && conversation.other_user?.is_online;
  const memberCount = conversation.members?.length || 0;

  const pinnedMessage = messages.find(m => m.is_pinned);

  return (
    <div className="flex-1 flex flex-col bg-tg-chat h-full">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between bg-tg-sidebar border-b border-tg-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-semibold text-sm">{conversationName}</h2>
            <p className="text-xs text-tg-muted">
              {conversation.type === 'dm'
                ? (otherOnline ? 'online' : 'offline')
                : `${memberCount} members`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {conversation.type === 'dm' && (
            <>
              <button onClick={() => onStartCall('audio')} className="p-2 hover:bg-tg-hover rounded-full transition" title="Audio call">
                <Phone className="w-5 h-5 text-tg-muted" />
              </button>
              <button onClick={() => onStartCall('video')} className="p-2 hover:bg-tg-hover rounded-full transition" title="Video call">
                <Video className="w-5 h-5 text-tg-muted" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pinned message */}
      {pinnedMessage && (
        <div className="px-4 py-2 bg-tg-sidebar/50 border-b border-tg-border flex items-center gap-2 text-sm">
          <Pin className="w-4 h-4 text-tg-accent flex-shrink-0" />
          <span className="text-tg-muted truncate">
            <span className="text-tg-accent">{pinnedMessage.sender?.display_name}: </span>
            {pinnedMessage.content}
          </span>
        </div>
      )}

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="text-center text-tg-muted py-8">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-tg-muted py-8">No messages yet. Say hello!</div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_id === user?.id}
              onReply={() => setReplyTo(msg)}
              onEdit={(content) => {
                const socket = getSocket();
                socket?.emit('message:edit', { messageId: msg.id, content });
              }}
              onDelete={() => {
                const socket = getSocket();
                socket?.emit('message:delete', { messageId: msg.id });
              }}
              onReaction={(emoji) => {
                const socket = getSocket();
                socket?.emit('message:reaction', { messageId: msg.id, emoji });
              }}
              onPin={() => {
                const socket = getSocket();
                socket?.emit('message:pin', { messageId: msg.id });
              }}
              onFavorite={async () => {
                await api.toggleFavorite(msg.id);
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_favorited: !m.is_favorited } : m));
              }}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.size > 0 && (
        <div className="px-4 py-1 text-xs text-tg-accent">
          <span className="typing-dots">
            Someone is typing<span>.</span><span>.</span><span>.</span>
          </span>
        </div>
      )}

      {/* Reply bar */}
      {replyTo && (
        <div className="px-4 py-2 bg-tg-sidebar/80 border-t border-tg-border flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-0.5 h-8 bg-tg-accent rounded-full flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-tg-accent font-medium">{replyTo.sender?.display_name}</p>
              <p className="text-xs text-tg-muted truncate">{replyTo.content}</p>
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-tg-muted hover:text-tg-text ml-2">✕</button>
        </div>
      )}

      {/* Input */}
      <MessageInput
        conversationId={conversation.id}
        onSend={handleSendMessage}
      />
    </div>
  );
}
