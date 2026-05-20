import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { CallState, SignalData } from '../types';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
};

export function useWebRTC(myId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [remoteId, setRemoteId] = useState<string>('');
  const [callerName, setCallerName] = useState<string>('');
  const [error, setError] = useState<string>('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const localStream = useRef<MediaStream | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Initialize socket
  useEffect(() => {
    if (!myId) return;

    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('register', myId);
    });

    newSocket.on('registered', (success) => {
      if (!success) {
        setError('Failed to register ID on server.');
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [myId]);

  // Request media permissions
  const getMediaStream = async () => {
    if (localStream.current) return localStream.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error("Failed to get local stream", err);
      setError("Camera/Microphone access denied.");
      return null;
    }
  };

  const stopMediaStream = () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }
  };

  // WebRTC Setup
  const createPeerConnection = useCallback((targetId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('signal', {
          to: targetId,
          from: myId,
          type: 'ice-candidate',
          signal: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        handleEndCall();
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [myId, socket]);

  // Handle incoming socket signals
  useEffect(() => {
    if (!socket) return;

    const handleSignal = async (data: SignalData) => {
      if (data.type === 'offer') {
        setRemoteId(data.from);
        setCallerName(data.callerName || 'Someone');
        setCallState('ringing');
        // Store the offer to answer later if accepted.
        peerConnection.current = new RTCPeerConnection(ICE_SERVERS);
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.signal));
      } else if (data.type === 'answer') {
        if (peerConnection.current) {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.signal));
          setCallState('connected');
        }
      } else if (data.type === 'ice-candidate') {
        if (peerConnection.current && peerConnection.current.remoteDescription) {
          try {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.signal));
          } catch (e) {
            console.error('Error adding received ice candidate', e);
          }
        } else {
           // Queue candidate or handle edge case if needed. For simplicity we ignore if remoteDescription is missing.
        }
      } else if (data.type === 'reject') {
         setError(`${data.callerName || 'User'} declined the call.`);
         handleEndCall(false);
      }
    };

    socket.on('signal', handleSignal);

    socket.on('call-error', (data) => {
      setError(data.message);
      handleEndCall(false);
    });

    socket.on('call-ended', () => {
      handleEndCall(false);
    });

    return () => {
      socket.off('signal', handleSignal);
      socket.off('call-error');
      socket.off('call-ended');
    };
  }, [socket, createPeerConnection, myId]);


  const startCall = async (targetId: string, myName: string) => {
    setError('');
    const stream = await getMediaStream();
    if (!stream) return;

    setRemoteId(targetId);
    setCallState('calling');

    const pc = createPeerConnection(targetId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket?.emit('signal', {
      to: targetId,
      from: myId,
      type: 'offer',
      signal: offer,
      callerName: myName,
    });
  };

  const answerCall = async () => {
    const stream = await getMediaStream();
    if (!stream) return;

    if (!peerConnection.current) return;

    // Add tracks to the newly created PC that has the remote offer
    stream.getTracks().forEach(track => peerConnection.current?.addTrack(track, stream));

    // Also attach ICE candidate handler for answer
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('signal', {
          to: remoteId,
          from: myId,
          type: 'ice-candidate',
          signal: event.candidate,
        });
      }
    };
    
    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };


    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);

    socket?.emit('signal', {
      to: remoteId,
      from: myId,
      type: 'answer',
      signal: answer,
    });

    setCallState('connected');
  };

  const rejectCall = () => {
    socket?.emit('signal', {
      to: remoteId,
      from: myId,
      type: 'reject'
    });
    handleEndCall(false);
  };

  const endCall = () => {
    socket?.emit('end-call', { to: remoteId });
    handleEndCall(true);
  };

  const handleEndCall = (isLocalInitiated: boolean = true) => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    stopMediaStream();
    setCallState('idle');
    setRemoteId('');
  };

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };


  return {
    callState,
    remoteId,
    callerName,
    error,
    setError,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    isMuted,
    toggleVideo,
    isVideoOff
  };
}
