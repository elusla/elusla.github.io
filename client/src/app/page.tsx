'use client';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import AuthPage from '@/components/AuthPage';
import ChatLayout from '@/components/ChatLayout';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-tg-bg">
        <div className="text-tg-accent text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) return <AuthPage />;
  return <ChatLayout />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
