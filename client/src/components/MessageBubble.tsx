'use client';
import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Reply, Edit3, Trash2, Pin, Star, Smile, MoreHorizontal, Check, CheckCheck, Download } from 'lucide-react';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👎', '🎉'];

interface Props {
  message: any;
  isOwn: boolean;
  onReply: () => void;
  onEdit: (content: string) => void;
  onDelete: () => void;
  onReaction: (emoji: string) => void;
  onPin: () => void;
  onFavorite: () => void;
}

export default function MessageBubble({ message, isOwn, onReply, onEdit, onDelete, onReaction, onPin, onFavorite }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowReactions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleEditSubmit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(editContent);
    }
    setEditing(false);
  };

  const renderContent = () => {
    if (message.type === 'image') {
      return (
        <div>
          <img src={message.file_url} alt="Photo" className="max-w-xs rounded-lg cursor-pointer" />
          {message.content && <p className="mt-1 text-sm">{message.content}</p>}
        </div>
      );
    }

    if (message.type === 'file') {
      return (
        <a href={message.file_url} download={message.file_name} className="flex items-center gap-2 text-tg-accent hover:underline">
          <Download className="w-4 h-4" />
          <div>
            <p className="text-sm">{message.file_name}</p>
            {message.file_size && <p className="text-xs text-tg-muted">{(message.file_size / 1024).toFixed(1)} KB</p>}
          </div>
        </a>
      );
    }

    if (message.type === 'voice') {
      return (
        <div>
          <audio controls src={message.file_url} className="max-w-[250px]" />
          {message.voice_transcript && (
            <p className="text-xs text-tg-muted mt-1 italic">📝 {message.voice_transcript}</p>
          )}
        </div>
      );
    }

    if (editing) {
      return (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleEditSubmit(); if (e.key === 'Escape') setEditing(false); }}
            className="bg-tg-input px-3 py-1 rounded-lg text-sm flex-1 focus:outline-none"
            autoFocus
          />
          <button onClick={handleEditSubmit} className="text-tg-accent text-sm">Save</button>
          <button onClick={() => setEditing(false)} className="text-tg-muted text-sm">Cancel</button>
        </div>
      );
    }

    return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
  };

  const groupedReactions = (message.reactions || []).reduce((acc: any, r: any) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r);
    return acc;
  }, {});

  return (
    <div className={`flex mb-2 message-enter ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className="relative group max-w-[65%]" ref={menuRef}>
        {/* Reply reference */}
        {message.reply_to && (
          <div className={`text-xs mb-1 px-3 py-1 rounded-t-lg border-l-2 border-tg-accent ${isOwn ? 'bg-tg-bubble-own/60' : 'bg-tg-bubble/60'}`}>
            <span className="text-tg-accent font-medium">{message.reply_to.sender?.display_name}</span>
            <p className="text-tg-muted truncate">{message.reply_to.content}</p>
          </div>
        )}

        <div className={`px-3 py-2 rounded-2xl relative ${
          isOwn
            ? 'bg-tg-bubble-own rounded-br-sm'
            : 'bg-tg-bubble rounded-bl-sm'
        }`}>
          {/* Sender name for groups */}
          {!isOwn && (
            <p className="text-xs text-tg-accent font-medium mb-0.5">{message.sender?.display_name}</p>
          )}

          {renderContent()}

          {/* Footer */}
          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {message.is_edited && <span className="text-[10px] text-tg-muted">edited</span>}
            {message.is_pinned && <Pin className="w-3 h-3 text-tg-accent" />}
            {message.is_favorited && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
            <span className="text-[10px] text-tg-muted">
              {format(new Date(message.created_at), 'HH:mm')}
            </span>
            {isOwn && <CheckCheck className="w-3 h-3 text-tg-accent" />}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(groupedReactions).map(([emoji, users]: [string, any]) => (
              <button key={emoji} onClick={() => onReaction(emoji)}
                className="bg-tg-input/60 hover:bg-tg-input px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition">
                <span>{emoji}</span>
                <span className="text-tg-muted">{users.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Actions on hover */}
        <div className={`absolute top-0 ${isOwn ? '-left-24' : '-right-24'} hidden group-hover:flex items-center gap-0.5 bg-tg-input rounded-lg p-0.5 shadow-lg`}>
          <button onClick={() => setShowReactions(!showReactions)} className="p-1 hover:bg-tg-hover rounded" title="React">
            <Smile className="w-4 h-4 text-tg-muted" />
          </button>
          <button onClick={onReply} className="p-1 hover:bg-tg-hover rounded" title="Reply">
            <Reply className="w-4 h-4 text-tg-muted" />
          </button>
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 hover:bg-tg-hover rounded" title="More">
            <MoreHorizontal className="w-4 h-4 text-tg-muted" />
          </button>
        </div>

        {/* Reaction picker */}
        {showReactions && (
          <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-10 bg-tg-input rounded-xl p-2 flex gap-1 shadow-lg z-10`}>
            {QUICK_REACTIONS.map(emoji => (
              <button key={emoji} onClick={() => { onReaction(emoji); setShowReactions(false); }}
                className="hover:scale-125 transition-transform text-lg p-0.5">
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Context menu */}
        {showMenu && (
          <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} top-full mt-1 bg-tg-input rounded-xl shadow-lg z-10 w-44 py-1`}>
            <button onClick={() => { onReply(); setShowMenu(false); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-tg-hover flex items-center gap-2">
              <Reply className="w-4 h-4" /> Reply
            </button>
            {isOwn && (
              <button onClick={() => { setEditing(true); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-tg-hover flex items-center gap-2">
                <Edit3 className="w-4 h-4" /> Edit
              </button>
            )}
            <button onClick={() => { onPin(); setShowMenu(false); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-tg-hover flex items-center gap-2">
              <Pin className="w-4 h-4" /> {message.is_pinned ? 'Unpin' : 'Pin'}
            </button>
            <button onClick={() => { onFavorite(); setShowMenu(false); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-tg-hover flex items-center gap-2">
              <Star className="w-4 h-4" /> {message.is_favorited ? 'Unsave' : 'Save'}
            </button>
            {isOwn && (
              <button onClick={() => { onDelete(); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-tg-hover flex items-center gap-2 text-red-400">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
