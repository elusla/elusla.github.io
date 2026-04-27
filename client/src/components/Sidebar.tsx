'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Conversation } from './ChatLayout';
import { Search, Menu, Users, LogOut, User, Plus, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onSelectConversation: (conv: Conversation) => void;
  onNewConversation: (conv: Conversation) => void;
  onShowProfile: () => void;
}

export default function Sidebar({ conversations, activeConversation, onSelectConversation, onNewConversation, onShowProfile }: Props) {
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<any[]>([]);

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (q.length > 0) {
      const results = await api.searchUsers(q.replace('@', ''));
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleStartDM = async (userId: string) => {
    const conv = await api.createDM(userId);
    onNewConversation(conv);
    setSearch('');
    setSearchResults([]);
  };

  const handleMemberSearch = async (q: string) => {
    setMemberSearch(q);
    if (q.length > 0) {
      const results = await api.searchUsers(q.replace('@', ''));
      setMemberResults(results);
    } else {
      setMemberResults([]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName || selectedMembers.length === 0) return;
    const conv = await api.createGroup(groupName, selectedMembers);
    onNewConversation(conv);
    setShowNewGroup(false);
    setGroupName('');
    setSelectedMembers([]);
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.type === 'group') return conv.name || 'Group';
    return conv.other_user?.display_name || conv.other_user?.username || 'Unknown';
  };

  const getAvatar = (conv: Conversation) => {
    const name = getConversationName(conv);
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];
    const color = colors[name.charCodeAt(0) % colors.length];
    return (
      <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
        {conv.type === 'group' ? <Users className="w-6 h-6" /> : name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const getLastMessagePreview = (conv: Conversation) => {
    if (!conv.last_message) return 'No messages yet';
    const msg = conv.last_message;
    if (msg.type === 'image') return '📷 Photo';
    if (msg.type === 'file') return '📎 File';
    if (msg.type === 'voice') return '🎤 Voice message';
    return msg.content || '';
  };

  return (
    <div className="w-[380px] bg-tg-sidebar border-r border-tg-border flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="p-3 flex items-center gap-3">
        <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-tg-hover rounded-full transition">
          <Menu className="w-5 h-5 text-tg-muted" />
        </button>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tg-muted" />
          <input
            type="text"
            placeholder="Search by @username..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-tg-input rounded-xl text-sm text-tg-text placeholder-tg-muted focus:outline-none"
          />
        </div>
      </div>

      {/* Menu dropdown */}
      {showMenu && (
        <div className="absolute top-14 left-3 bg-tg-input rounded-xl shadow-lg z-50 w-56 py-2">
          <button onClick={() => { onShowProfile(); setShowMenu(false); }}
            className="w-full px-4 py-2 text-left hover:bg-tg-hover flex items-center gap-3 text-sm">
            <User className="w-4 h-4" /> Profile
          </button>
          <button onClick={() => { setShowNewGroup(true); setShowMenu(false); }}
            className="w-full px-4 py-2 text-left hover:bg-tg-hover flex items-center gap-3 text-sm">
            <Plus className="w-4 h-4" /> New Group
          </button>
          <hr className="border-tg-border my-1" />
          <button onClick={logout}
            className="w-full px-4 py-2 text-left hover:bg-tg-hover flex items-center gap-3 text-sm text-red-400">
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </div>
      )}

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="px-3 pb-2">
          <p className="text-xs text-tg-muted px-2 mb-1">Users</p>
          {searchResults.map(u => (
            <button key={u.id} onClick={() => handleStartDM(u.id)}
              className="w-full p-2 flex items-center gap-3 hover:bg-tg-hover rounded-lg transition">
              <div className="w-10 h-10 rounded-full bg-tg-accent flex items-center justify-center text-white font-bold">
                {u.display_name?.charAt(0).toUpperCase() || u.username.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">{u.display_name || u.username}</div>
                <div className="text-xs text-tg-muted">@{u.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelectConversation(conv)}
            className={`w-full p-3 flex items-center gap-3 hover:bg-tg-hover transition ${
              activeConversation?.id === conv.id ? 'bg-tg-blue' : ''
            }`}
          >
            <div className="relative">
              {getAvatar(conv)}
              {conv.type === 'dm' && conv.other_user?.is_online && (
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-tg-green rounded-full border-2 border-tg-sidebar" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate">{getConversationName(conv)}</span>
                {conv.last_message && (
                  <span className="text-xs text-tg-muted flex-shrink-0">
                    {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-sm text-tg-muted truncate">{getLastMessagePreview(conv)}</span>
                {conv.unread_count > 0 && (
                  <span className="bg-tg-accent text-white text-xs rounded-full px-2 py-0.5 flex-shrink-0 ml-2">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* New group modal */}
      {showNewGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-tg-sidebar p-6 rounded-2xl w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Group</h3>
              <button onClick={() => setShowNewGroup(false)}><X className="w-5 h-5" /></button>
            </div>
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="w-full px-4 py-2 bg-tg-input rounded-xl text-sm mb-3 text-tg-text placeholder-tg-muted focus:outline-none"
            />
            <input
              type="text"
              placeholder="Search members by @username"
              value={memberSearch}
              onChange={e => handleMemberSearch(e.target.value)}
              className="w-full px-4 py-2 bg-tg-input rounded-xl text-sm mb-3 text-tg-text placeholder-tg-muted focus:outline-none"
            />
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {selectedMembers.map(id => (
                  <span key={id} className="bg-tg-accent/20 text-tg-accent text-xs px-2 py-1 rounded-full">
                    {memberResults.find(u => u.id === id)?.username || id}
                    <button onClick={() => setSelectedMembers(prev => prev.filter(m => m !== id))} className="ml-1">×</button>
                  </span>
                ))}
              </div>
            )}
            {memberResults.map(u => (
              <button key={u.id}
                onClick={() => setSelectedMembers(prev => prev.includes(u.id) ? prev.filter(m => m !== u.id) : [...prev, u.id])}
                className={`w-full p-2 flex items-center gap-3 rounded-lg transition ${selectedMembers.includes(u.id) ? 'bg-tg-blue/30' : 'hover:bg-tg-hover'}`}
              >
                <div className="w-8 h-8 rounded-full bg-tg-accent flex items-center justify-center text-white text-sm font-bold">
                  {u.display_name?.charAt(0) || u.username.charAt(0)}
                </div>
                <span className="text-sm">@{u.username}</span>
              </button>
            ))}
            <button onClick={handleCreateGroup}
              disabled={!groupName || selectedMembers.length === 0}
              className="w-full mt-4 py-2 bg-tg-accent text-white rounded-xl font-medium disabled:opacity-50 hover:bg-blue-400 transition"
            >
              Create Group
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
