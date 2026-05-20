import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

export function useGroupCall(socket: Socket | null, myId: string) {
  const [inGroup, setInGroup] = useState<string>('');
  const [groupUsers, setGroupUsers] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);

  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerStreams = useRef<Map<string, MediaStream>>(new Map());
  const iceCandidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map());

  const stopMediaStream = () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }
    peers.current.forEach(pc => pc.close());
    peers.current.clear();
    peerStreams.current.clear();
    iceCandidateQueues.current.clear();
    audioElements.current.forEach(audio => {
        audio.pause();
        audio.remove();
    });
    audioElements.current.clear();
    setGroupUsers([]);
    setInGroup('');
    setIsMuted(false);
  };

  const getAudioStream = async () => {
    if (localStream.current) return localStream.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.current = stream;
      return stream;
    } catch (err) {
      setError("Microphone access denied. Please allow permissions.");
      return null;
    }
  };

  const createPeer = useCallback((targetId: string, initiator: boolean) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peers.current.set(targetId, pc);
    iceCandidateQueues.current.set(targetId, []);

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('group-signal', {
          to: targetId,
          from: myId,
          type: 'ice-candidate',
          signal: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (!peerStreams.current.has(targetId)) {
        peerStreams.current.set(targetId, new MediaStream());
      }
      const stream = peerStreams.current.get(targetId)!;
      stream.addTrack(event.track);

      if (!audioElements.current.has(targetId)) {
        const audio = new Audio();
        audio.autoplay = true;
        audio.srcObject = stream;
        audioElements.current.set(targetId, audio);
      }
    };
    
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            removePeer(targetId);
        }
    };

    return pc;
  }, [myId, socket]);

  const removePeer = (targetId: string) => {
    const pc = peers.current.get(targetId);
    if (pc) {
      pc.close();
      peers.current.delete(targetId);
    }
    peerStreams.current.delete(targetId);
    const audio = audioElements.current.get(targetId);
    if (audio) {
      audio.pause();
      audio.remove();
      audioElements.current.delete(targetId);
    }
    setGroupUsers(prev => prev.filter(id => id !== targetId));
  };

  useEffect(() => {
    if (!socket) return;

    const handleUserJoined = async (userId: string) => {
      console.log("User joined group:", userId);
      setGroupUsers(prev => [...prev, userId]);
      
      const pc = createPeer(userId, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit('group-signal', {
        to: userId,
        from: myId,
        type: 'offer',
        signal: offer,
      });
    };

    const handleRoomUsers = (users: string[]) => {
      setGroupUsers(users);
    };

    const handleUserLeft = (userId: string) => {
      console.log("User left group:", userId);
      removePeer(userId);
    };

    const handleGroupSignal = async (data: { from: string, signal: any, type: string }) => {
      try {
        if (data.type === 'offer') {
          const pc = createPeer(data.from, false);
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          socket.emit('group-signal', {
            to: data.from,
            from: myId,
            type: 'answer',
            signal: answer,
          });

          const queue = iceCandidateQueues.current.get(data.from) || [];
          for (const candidate of queue) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          iceCandidateQueues.current.set(data.from, []);

        } else if (data.type === 'answer') {
          const pc = peers.current.get(data.from);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
          }
        } else if (data.type === 'ice-candidate') {
          const pc = peers.current.get(data.from);
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.signal));
          } else {
            const queue = iceCandidateQueues.current.get(data.from) || [];
            queue.push(data.signal);
            iceCandidateQueues.current.set(data.from, queue);
          }
        }
      } catch (err) {
        console.error("Group signal error:", err);
      }
    };

    socket.on('user-joined', handleUserJoined);
    socket.on('room-users', handleRoomUsers);
    socket.on('user-left', handleUserLeft);
    socket.on('group-signal', handleGroupSignal);

    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('room-users', handleRoomUsers);
      socket.off('user-left', handleUserLeft);
      socket.off('group-signal', handleGroupSignal);
    };
  }, [socket, createPeer, myId]);

  const joinGroup = async (roomId: string) => {
    setError('');
    const stream = await getAudioStream();
    if (!stream) return;
    
    setInGroup(roomId);
    socket?.emit('join-room', roomId);
  };

  const leaveGroup = () => {
    if (inGroup && socket) {
      socket.emit('leave-room', inGroup);
    }
    stopMediaStream();
  };

  const toggleMuteGroup = () => {
    if (localStream.current) {
        localStream.current.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsMuted(!isMuted);
    }
  };

  return {
    inGroup,
    groupUsers,
    joinGroup,
    leaveGroup,
    toggleMuteGroup,
    isMuted,
    groupError: error,
    setGroupError: setError
  };
}
