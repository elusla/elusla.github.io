const API_BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || 'Request failed');
  }
  
  return res.json();
}

export const api = {
  // Auth
  register: (data: { username: string; email: string; password: string; displayName?: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { login: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),
  updateProfile: (data: { displayName?: string; bio?: string; avatarUrl?: string }) =>
    request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Users
  searchUsers: (q: string) => request(`/users/search?q=${encodeURIComponent(q)}`),
  getUser: (id: string) => request(`/users/${id}`),

  // Conversations
  getConversations: () => request('/conversations'),
  createDM: (userId: string) => request('/conversations/dm', { method: 'POST', body: JSON.stringify({ userId }) }),
  createGroup: (name: string, memberIds: string[]) =>
    request('/conversations/group', { method: 'POST', body: JSON.stringify({ name, memberIds }) }),
  getConversation: (id: string) => request(`/conversations/${id}`),

  // Messages
  getMessages: (conversationId: string, before?: string) =>
    request(`/messages/${conversationId}${before ? `?before=${before}` : ''}`),
  editMessage: (id: string, content: string) =>
    request(`/messages/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteMessage: (id: string) => request(`/messages/${id}`, { method: 'DELETE' }),
  toggleReaction: (id: string, emoji: string) =>
    request(`/messages/${id}/reaction`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  togglePin: (id: string) => request(`/messages/${id}/pin`, { method: 'POST' }),
  toggleFavorite: (id: string) => request(`/messages/${id}/favorite`, { method: 'POST' }),
  getFavorites: () => request('/messages/favorites/all'),

  // Upload
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/upload', { method: 'POST', body: formData });
  },
};
