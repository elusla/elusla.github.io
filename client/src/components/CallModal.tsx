'use client';
import { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface Props {
  call: {
    callerId: string;
    targetUserId?: string;
    callType: 'audio' | 'video';
    conversationId: string;
  };
  onEnd: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

export default function CallModal({ call, onEnd }: Props) {
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(call.callType === 'audio');
  const [duration, setDuration] = useState(0);
  const [connected, setConnected] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (connected) setDuration(d => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [connected]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const setupCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: call.callType === 'video'
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
          setConnected(true);
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const targetUserId = call.targetUserId || call.callerId;
            socket.emit('webrtc:ice-candidate', { targetUserId, candidate: event.candidate });
          }
        };

        // If we initiated the call, create offer
        if (call.targetUserId) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:offer', { targetUserId: call.targetUserId, offer });
        }

        // Handle incoming offer
        socket.on('webrtc:offer', async ({ userId, offer }) => {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc:answer', { targetUserId: userId, answer });
        });

        // Handle answer
        socket.on('webrtc:answer', async ({ answer }) => {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          setConnected(true);
        });

        // Handle ICE candidates
        socket.on('webrtc:ice-candidate', async ({ candidate }) => {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('Failed to add ICE candidate:', err);
          }
        });

        // Handle call ended by other party
        socket.on('call:ended', () => {
          cleanup();
          onEnd();
        });

        socket.on('call:accepted', async () => {
          // Other party accepted — send offer if we haven't
          if (call.targetUserId && !pc.currentLocalDescription) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('webrtc:offer', { targetUserId: call.targetUserId, offer });
          }
        });

      } catch (err) {
        console.error('Call setup failed:', err);
      }
    };

    setupCall();

    return () => {
      cleanup();
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
      socket.off('call:ended');
      socket.off('call:accepted');
    };
  }, []);

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(!muted);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setVideoOff(!videoOff);
  };

  const handleEnd = () => {
    cleanup();
    onEnd();
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-tg-bg/95 flex flex-col items-center justify-center z-50">
      {call.callType === 'video' ? (
        <div className="relative w-full h-full max-w-4xl max-h-[70vh]">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover rounded-2xl bg-black" />
          <video ref={localVideoRef} autoPlay playsInline muted
            className="absolute bottom-4 right-4 w-40 h-30 object-cover rounded-xl border-2 border-tg-border bg-black" />
        </div>
      ) : (
        <div className="text-center mb-8">
          <div className="w-24 h-24 rounded-full bg-tg-accent flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
            📞
          </div>
          <p className="text-xl font-medium mb-2">{connected ? 'Connected' : 'Calling...'}</p>
          <p className="text-tg-muted">{formatDuration(duration)}</p>
          <audio ref={remoteVideoRef} autoPlay />
        </div>
      )}

      <div className="flex items-center gap-4 mt-8">
        <button onClick={toggleMute}
          className={`p-4 rounded-full ${muted ? 'bg-red-500' : 'bg-tg-input'} transition`}>
          {muted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-tg-text" />}
        </button>
        {call.callType === 'video' && (
          <button onClick={toggleVideo}
            className={`p-4 rounded-full ${videoOff ? 'bg-red-500' : 'bg-tg-input'} transition`}>
            {videoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-tg-text" />}
          </button>
        )}
        <button onClick={handleEnd} className="p-4 bg-red-600 rounded-full hover:bg-red-500 transition">
          <PhoneOff className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );
}
