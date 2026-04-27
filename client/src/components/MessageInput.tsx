'use client';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Paperclip, Smile, Send, Mic, MicOff, Image, File as FileIcon } from 'lucide-react';

interface Props {
  conversationId: string;
  onSend: (data: {
    content?: string;
    type?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    voiceTranscript?: string;
  }) => void;
}

const EMOJI_LIST = ['😀', '😂', '🥰', '😎', '🤔', '👍', '❤️', '🔥', '🎉', '😢', '😮', '🙏', '💪', '👋', '🤝', '💯', '⭐', '🚀', '✨', '🎯', '🌟', '💬', '📌', '🗑️'];

export default function MessageInput({ conversationId, onSend }: Props) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<any>(null);

  const handleSend = () => {
    if (!text.trim() && !uploading) return;
    onSend({ content: text.trim(), type: 'text' });
    setText('');
    const socket = getSocket();
    socket?.emit('typing:stop', { conversationId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = (value: string) => {
    setText(value);
    const socket = getSocket();
    if (!socket) return;

    socket.emit('typing:start', { conversationId });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId });
    }, 2000);
  };

  const handleFileUpload = async (file: File, type: string) => {
    setUploading(true);
    setShowAttach(false);
    try {
      const result = await api.uploadFile(file);
      onSend({
        content: type === 'image' ? '' : file.name,
        type,
        fileUrl: result.url,
        fileName: result.name,
        fileSize: result.size,
      });
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      audioChunks.current = [];

      recorder.ondataavailable = (e) => audioChunks.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const file = new File([blob], 'voice-message.webm', { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());

        setUploading(true);
        try {
          const result = await api.uploadFile(file);
          
          // Try speech recognition
          let transcript = '';
          if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            try {
              const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
              const recognition = new SpeechRecognition();
              recognition.continuous = false;
              recognition.interimResults = false;
              
              transcript = await new Promise<string>((resolve) => {
                recognition.onresult = (event: any) => {
                  resolve(event.results[0][0].transcript);
                };
                recognition.onerror = () => resolve('');
                recognition.onend = () => resolve('');
                
                // Play audio to recognize (this is simplified - real implementation would need audio playback)
                setTimeout(() => resolve(''), 3000);
                recognition.start();
              });
            } catch {
              // Speech recognition not available
            }
          }

          onSend({
            type: 'voice',
            fileUrl: result.url,
            fileName: result.name,
            fileSize: result.size,
            voiceTranscript: transcript || undefined,
          });
        } catch (err) {
          console.error('Voice upload failed:', err);
        }
        setUploading(false);
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }
    setRecording(false);
  };

  return (
    <div className="px-4 py-3 bg-tg-sidebar border-t border-tg-border flex-shrink-0">
      <div className="flex items-center gap-2">
        {/* Attach */}
        <div className="relative">
          <button onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); }}
            className="p-2 hover:bg-tg-hover rounded-full transition">
            <Paperclip className="w-5 h-5 text-tg-muted" />
          </button>
          {showAttach && (
            <div className="absolute bottom-12 left-0 bg-tg-input rounded-xl shadow-lg w-44 py-2 z-10">
              <label className="flex items-center gap-2 px-3 py-2 hover:bg-tg-hover cursor-pointer text-sm">
                <Image className="w-4 h-4 text-tg-accent" /> Photo
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'image')} />
              </label>
              <label className="flex items-center gap-2 px-3 py-2 hover:bg-tg-hover cursor-pointer text-sm">
                <FileIcon className="w-4 h-4 text-tg-accent" /> File
                <input type="file" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'file')} />
              </label>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={e => handleTyping(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={uploading ? 'Uploading...' : 'Write a message...'}
            disabled={uploading}
            className="w-full px-4 py-2.5 bg-tg-input rounded-xl text-sm text-tg-text placeholder-tg-muted focus:outline-none"
          />
        </div>

        {/* Emoji */}
        <div className="relative">
          <button onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); }}
            className="p-2 hover:bg-tg-hover rounded-full transition">
            <Smile className="w-5 h-5 text-tg-muted" />
          </button>
          {showEmoji && (
            <div className="absolute bottom-12 right-0 bg-tg-input rounded-xl shadow-lg p-3 z-10 w-72">
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_LIST.map(emoji => (
                  <button key={emoji}
                    onClick={() => { setText(prev => prev + emoji); setShowEmoji(false); inputRef.current?.focus(); }}
                    className="text-xl p-1 hover:bg-tg-hover rounded transition hover:scale-110">
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Send / Voice */}
        {text.trim() ? (
          <button onClick={handleSend} className="p-2 bg-tg-accent hover:bg-blue-400 rounded-full transition">
            <Send className="w-5 h-5 text-white" />
          </button>
        ) : (
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`p-2 rounded-full transition ${recording ? 'bg-red-500 animate-pulse' : 'hover:bg-tg-hover'}`}
          >
            {recording ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-tg-muted" />}
          </button>
        )}
      </div>
    </div>
  );
}
