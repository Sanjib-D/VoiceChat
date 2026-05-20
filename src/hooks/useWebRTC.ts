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

  const remoteVideoElement = useRef<HTMLVideoElement | null>(null);
  const localVideoElement = useRef<HTMLVideoElement | null>(null);

  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Callback refs to instantly attach streams when the video components mount
  const remoteVideoRef = useCallback((node: HTMLVideoElement | null) => {
    remoteVideoElement.current = node;
    if (node && remoteStream.current) {
      node.srcObject = remoteStream.current;
    }
  }, []);

  const localVideoRef = useCallback((node: HTMLVideoElement | null) => {
    localVideoElement.current = node;
    if (node && localStream.current) {
      node.srcObject = localStream.current;
    }
  }, []);

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
      if (localVideoElement.current) {
        localVideoElement.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error("Failed to get local stream", err);
      setError("Camera/Microphone access denied. Please allow permissions.");
      return null;
    }
  };

  const stopMediaStream = () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }
  };

  const handleEndCall = useCallback((isLocalInitiated: boolean = true) => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    stopMediaStream();
    remoteStream.current = null;
    iceCandidateQueue.current = [];
    setCallState('idle');
    setRemoteId('');
    setIsMuted(false);
    setIsVideoOff(false);
  }, []);

  // Unified PeerConnection setup
  const setupPeerConnection = useCallback((targetId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnection.current = pc;
    remoteStream.current = new MediaStream();

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
      if (remoteStream.current) {
        remoteStream.current.addTrack(event.track);
        if (remoteVideoElement.current) {
          remoteVideoElement.current.srcObject = remoteStream.current;
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        handleEndCall(false);
      }
    };

    return pc;
  }, [myId, socket, handleEndCall]);

  // Handle incoming socket signals
  useEffect(() => {
    if (!socket) return;

    const handleSignal = async (data: SignalData) => {
      try {
        if (data.type === 'offer') {
          setRemoteId(data.from);
          setCallerName(data.callerName || 'Someone');
          setCallState('ringing');
          
          const pc = setupPeerConnection(data.from);
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
          
          // Process queued ICE candidates
          while (iceCandidateQueue.current.length > 0) {
            const candidate = iceCandidateQueue.current.shift();
            if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } 
        else if (data.type === 'answer') {
          if (peerConnection.current) {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.signal));
            setCallState('connected');
          }
        } 
        else if (data.type === 'ice-candidate') {
          if (peerConnection.current && peerConnection.current.remoteDescription) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.signal));
          } else {
            iceCandidateQueue.current.push(data.signal);
          }
        } 
        else if (data.type === 'reject') {
           setError(`${data.callerName || 'User'} declined the call.`);
           handleEndCall(false);
        }
      } catch (err) {
        console.error("Error processing signal:", err);
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
  }, [socket, setupPeerConnection, handleEndCall]);


  const startCall = async (targetId: string, myName: string) => {
    setError('');
    const stream = await getMediaStream();
    if (!stream) return;

    setRemoteId(targetId);
    setCallState('calling');

    const pc = setupPeerConnection(targetId);
    
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

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

    stream.getTracks().forEach(track => peerConnection.current?.addTrack(track, stream));

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
