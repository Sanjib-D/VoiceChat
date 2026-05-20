import { useEffect, useState } from "react";
import { useWebRTC } from "./hooks/useWebRTC";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, PhoneIncoming, AlertCircle } from "lucide-react";

export default function App() {
  const [myId, setMyId] = useState<string>("");
  const [myName, setMyName] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");

  useEffect(() => {
    const savedId = localStorage.getItem("webrtc-id");
    const savedName = localStorage.getItem("webrtc-name") || "Guest";
    
    if (savedId) {
      setMyId(savedId);
    } else {
      const newId = Math.floor(100000 + Math.random() * 900000).toString();
      localStorage.setItem("webrtc-id", newId);
      setMyId(newId);
    }
    setMyName(savedName);
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMyName(e.target.value);
    localStorage.setItem("webrtc-name", e.target.value);
  };

  const {
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
  } = useWebRTC(myId);

  if (!myId) return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="animate-pulse text-gray-500">Initializing...</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-900">
      
      {/* HEADER / IDENTITY */}
      {callState === "idle" && (
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden mb-6 border border-gray-100">
          <div className="bg-blue-600 p-6 text-white text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Connect Online</h1>
            <p className="text-blue-100 mt-1 text-sm">Share your ID to receive calls</p>
          </div>
          
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Your ID</label>
              <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center">
                <span className="text-4xl font-mono font-bold tracking-[0.25em] text-gray-800">{myId}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Display Name</label>
              <input
                type="text"
                value={myName}
                onChange={handleNameChange}
                placeholder="Enter your name"
                className="w-full border border-gray-300 px-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="pt-4 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Make a call</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit ID"
                  className="flex-1 border border-gray-300 px-4 py-3 rounded-lg font-mono text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
                <button
                  onClick={() => {
                    if (targetId.length !== 6) {
                       setError("Please enter a valid 6-digit ID");
                       return;
                    }
                    startCall(targetId, myName);
                  }}
                  disabled={targetId.length !== 6}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Phone className="w-5 h-5" />
                  Call
                </button>
              </div>
              {error && (
                <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INCOMING CALL MODAL */}
      {callState === "ringing" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <PhoneIncoming className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{callerName}</h2>
            <p className="text-gray-500 mb-8">Incoming video call...</p>
            
            <div className="flex justify-center gap-6">
              <button
                onClick={rejectCall}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30"
              >
                <PhoneOff className="w-8 h-8" />
              </button>
              <button
                onClick={answerCall}
                className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-green-500/30"
              >
                <Phone className="w-8 h-8" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE/OUTGOING CALL SCREEN */}
      {(callState === "connected" || callState === "calling") && (
        <div className="fixed inset-0 bg-gray-900 z-40 flex flex-col">
          {/* Header */}
          <div className="bg-gray-900/80 backdrop-blur-md p-6 absolute top-0 left-0 right-0 z-10 flex flex-col items-center">
            <h2 className="text-white text-xl font-medium">
               {callState === "calling" ? `Calling ${targetId}...` : `In call with ${remoteId}`}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
               {callState === "calling" ? "Waiting for answer" : "Secure connection"}
            </p>
          </div>

          {/* Videos Container */}
          <div className="flex-1 relative bg-black overflow-hidden flex items-center justify-center">
            {/* Remote Video (Full Screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{ display: callState === "connected" ? "block" : "none" }}
            />
            {callState === "calling" && (
                <div className="text-gray-500 animate-pulse text-lg">Waiting for video...</div>
            )}

            {/* Local Video (Floating PIP) */}
            <div className="absolute bottom-28 right-6 w-32 h-48 sm:w-48 sm:h-64 bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-700/50">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
              />
              {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-gray-500">
                  <VideoOff className="w-8 h-8" />
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="bg-gray-900/90 backdrop-blur-xl p-6 pb-10 flex justify-center gap-6 absolute bottom-0 left-0 right-0">
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-all ${
                isMuted ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            
            <button
              onClick={endCall}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-red-500/20"
            >
              <PhoneOff className="w-7 h-7" />
            </button>

            <button
              onClick={toggleVideo}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-all ${
                isVideoOff ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
