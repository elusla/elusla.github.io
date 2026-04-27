'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import ProfilePanel from './ProfilePanel';
import CallModal from './CallModal';

export interface Conversation {
  id: string;
  type: 'dm' | 'group';
  name: string | null;
  avatar_url: string | null;
  other_user: any;
  last_message: any;
  unread_count: number;
  members: any[];
  updated_at: string;
  pinned_message_id: string | null;
}

export default function ChatLayout() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (msg: any) => {
      setConversations(prev => {
        const updated = prev.map(c => {
          if (c.id === msg.conversation_id) {
            return {
              ...c,
              last_message: { id: msg.id, content: msg.content, type: msg.type, sender_id: msg.sender_id, created_at: msg.created_at },
              unread_count: activeConversation?.id === msg.conversation_id ? c.unread_count : c.unread_count + 1,
              updated_at: msg.created_at
            };
          }
          return c;
        });
        return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      });
    };

    const handleOnline = ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setConversations(prev => prev.map(c => {
        if (c.type === 'dm' && c.other_user?.id === userId) {
          return { ...c, other_user: { ...c.other_user, is_online: isOnline } };
        }
        return c;
      }));
    };

    const handleIncomingCall = (data: any) => {
      setIncomingCall(data);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('user:online', handleOnline);
    socket.on('call:incoming', handleIncomingCall);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('user:online', handleOnline);
      socket.off('call:incoming', handleIncomingCall);
    };
  }, [activeConversation]);

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    setShowProfile(false);
    // Reset unread
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    // Join room & mark read
    const socket = getSocket();
    if (socket) {
      socket.emit('conversation:join', { conversationId: conv.id });
      socket.emit('messages:read', { conversationId: conv.id });
    }
  };

  const handleNewConversation = (conv: Conversation) => {
    setConversations(prev => {
      const exists = prev.find(c => c.id === conv.id);
      if (exists) return prev;
      return [conv, ...prev];
    });
    handleSelectConversation(conv);
  };

  const handleAcceptCall = () => {
    if (incomingCall) {
      setActiveCall(incomingCall);
      setIncomingCall(null);
      const socket = getSocket();
      socket?.emit('call:accept', { callerId: incomingCall.callerId });
    }
  };

  const handleRejectCall = () => {
    if (incomingCall) {
      const socket = getSocket();
      socket?.emit('call:reject', { callerId: incomingCall.callerId });
      setIncomingCall(null);
    }
  };

  return (
    <div className="h-screen flex bg-tg-bg">
      <Sidebar
        conversations={conversations}
        activeConversation={activeConversation}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onShowProfile={() => setShowProfile(true)}
      />
      
      {activeConversation ? (
        <ChatWindow
          conversation={activeConversation}
          onRefreshConversations={loadConversations}
          onStartCall={(callType) => {
            const targetUserId = activeConversation.other_user?.id;
            if (!targetUserId) return;
            const socket = getSocket();
            socket?.emit('call:initiate', {
              targetUserId,
              conversationId: activeConversation.id,
              callType
            });
            setActiveCall({ callerId: user?.id, callType, targetUserId, conversationId: activeConversation.id });
          }}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-tg-chat">
          <div className="text-center text-tg-muted">
            <div className="text-6xl mb-4">💬</div>
            <p className="text-xl">Select a chat to start messaging</p>
          </div>
        </div>
      )}

      {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} />}

      {incomingCall && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-tg-sidebar p-8 rounded-2xl text-center">
            <div className="text-xl mb-4">Incoming {incomingCall.callType} call</div>
            <div className="flex gap-4 justify-center">
              <button onClick={handleAcceptCall} className="px-6 py-3 bg-green-600 rounded-xl text-white">Accept</button>
              <button onClick={handleRejectCall} className="px-6 py-3 bg-red-600 rounded-xl text-white">Reject</button>
            </div>
          </div>
        </div>
      )}

      {activeCall && (
        <CallModal
          call={activeCall}
          onEnd={() => {
            const socket = getSocket();
            socket?.emit('call:end', { targetUserId: activeCall.targetUserId || activeCall.callerId });
            setActiveCall(null);
          }}
        />
      )}
    </div>
  );
}
