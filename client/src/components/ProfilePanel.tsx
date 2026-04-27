'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { X, Camera } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function ProfilePanel({ onClose }: Props) {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateProfile({ displayName, bio });
      updateUser(updated);
      onClose();
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      const result = await api.uploadFile(file);
      const updated = await api.updateProfile({ avatarUrl: result.url });
      updateUser(updated);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-tg-sidebar rounded-2xl w-96 max-h-[80vh] overflow-y-auto">
        <div className="p-4 flex items-center justify-between border-b border-tg-border">
          <h2 className="text-lg font-semibold">Profile</h2>
          <button onClick={onClose} className="p-1 hover:bg-tg-hover rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full bg-tg-accent flex items-center justify-center text-white text-3xl font-bold">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                user?.display_name?.charAt(0).toUpperCase() || '?'
              )}
            </div>
            <label className="absolute bottom-0 right-0 p-1.5 bg-tg-accent rounded-full cursor-pointer hover:bg-blue-400 transition">
              <Camera className="w-4 h-4 text-white" />
              <input type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
            </label>
          </div>

          <p className="text-tg-muted text-sm mb-6">@{user?.username}</p>

          <div className="w-full space-y-4">
            <div>
              <label className="text-xs text-tg-muted">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 bg-tg-input rounded-xl text-sm mt-1 text-tg-text focus:outline-none focus:border-tg-accent border border-transparent"
              />
            </div>
            <div>
              <label className="text-xs text-tg-muted">Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-tg-input rounded-xl text-sm mt-1 text-tg-text focus:outline-none resize-none focus:border-tg-accent border border-transparent"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 bg-tg-accent text-white rounded-xl font-medium hover:bg-blue-400 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
