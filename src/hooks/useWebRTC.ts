import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { useAppStore } from '../store/useAppStore';

export function useWebRTC() {
  const { socket, users } = useAppStore();
  const [inVoice, setInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  
  const localStream = useRef<MediaStream | null>(null);
  const peersRef = useRef<{ [socketId: string]: any }>({});
  // Keeping track of users currently in voice chat
  const [voiceUsers, setVoiceUsers] = useState<string[]>([]);
  const audioElements = useRef<{ [socketId: string]: any }>({});

  // Helper to destroy all peers
  const destroyAllPeers = () => {
    Object.values(peersRef.current).forEach((peer: any) => peer.destroy());
    peersRef.current = {};
    Object.values(audioElements.current).forEach((audio: any) => {
      audio.pause();
      audio.srcObject = null;
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
    });
    audioElements.current = {};
  };

  useEffect(() => {
    if (!socket) return;

    socket.on("user-joined-voice", (socketId: string) => {
      setVoiceUsers(prev => [...prev, socketId]);
      
      // If we are in voice, we initiate a peer connection to them
      if (inVoice && localStream.current) {
        const peer = new Peer({
          initiator: true,
          trickle: false,
          stream: localStream.current,
          config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        peer.on("signal", signal => {
          socket.emit("webrtc-signal", { to: socketId, signal });
        });

        peer.on("stream", stream => {
          let audio = audioElements.current[socketId];
          if (!audio) {
            audio = new Audio();
            audio.autoplay = true;
            document.body.appendChild(audio);
            audioElements.current[socketId] = audio;
          }
          audio.srcObject = stream;
        });

        peersRef.current[socketId] = peer;
      }
    });

    socket.on("user-left-voice", (socketId: string) => {
      setVoiceUsers(prev => prev.filter(id => id !== socketId));
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].destroy();
        delete peersRef.current[socketId];
      }
      if (audioElements.current[socketId]) {
        audioElements.current[socketId].pause();
        if (audioElements.current[socketId].parentNode) {
          audioElements.current[socketId].parentNode.removeChild(audioElements.current[socketId]);
        }
        delete audioElements.current[socketId];
      }
    });

    socket.on("webrtc-signal", ({ signal, from }: { signal: any, from: string }) => {
      // If we're not in voice, we shouldn't care (but really we should check)
      if (!inVoice) return;
      
      let peer = peersRef.current[from];
      if (!peer) {
        // We received a signal from an initiator, so we create a responding peer
        peer = new Peer({
          initiator: false,
          trickle: false,
          stream: localStream.current || undefined,
          config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
        });

        peer.on("signal", respSignal => {
          socket.emit("webrtc-signal", { to: from, signal: respSignal });
        });

        peer.on("stream", stream => {
          let audio = audioElements.current[from];
          if (!audio) {
            audio = new Audio();
            audio.autoplay = true;
            document.body.appendChild(audio);
            audioElements.current[from] = audio;
          }
          audio.srcObject = stream;
        });

        peersRef.current[from] = peer;
      }
      
      peer.signal(signal);
    });

    return () => {
      socket.off("user-joined-voice");
      socket.off("user-left-voice");
      socket.off("webrtc-signal");
      destroyAllPeers();
    };
  }, [socket, inVoice]);

  // Update muted state of our stream
  useEffect(() => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Update deafened state of remote streams
  useEffect(() => {
    Object.values(audioElements.current).forEach((audio: any) => {
      audio.muted = isDeafened;
    });
  }, [isDeafened]);

  const disconnect = () => {
    if (inVoice) {
      if (localStream.current) {
        localStream.current.getTracks().forEach(t => t.stop());
        localStream.current = null;
      }
      destroyAllPeers();
      setInVoice(false);
      if (socket) socket.emit("leave-voice");
    }
  };

  const toggleVoice = async () => {
    if (inVoice) {
      disconnect();
    } else {
      // Join voice
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Apply default mute
        stream.getAudioTracks().forEach(track => {
          track.enabled = !isMuted;
        });
        localStream.current = stream;
        
        setInVoice(true);
        if (socket) socket.emit("join-voice");
        
        // Self id to voiceUsers for UI? 
        // We don't really need our own ID, but let's just make sure others show up.
      } catch (err) {
        console.error("Failed to get local stream", err);
        alert("Failed to access microphone.");
      }
    }
  };

  return {
    inVoice,
    toggleVoice,
    isMuted,
    setIsMuted,
    isDeafened,
    setIsDeafened,
    voiceUsers,
    disconnect
  };
}
