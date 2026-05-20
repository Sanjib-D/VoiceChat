import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Hash, LogOut, Mic, MicOff, PhoneOff, Send, User, Volume2, VolumeX, MessageSquare, Users, PlusCircle } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';

export function ChatLayout() {
  const { username, userId, friends, setFriends, roomId, socket, messages, users, isConnected, resetRoom, logout, isInRoom, error, setError } = useAppStore();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'personal' | 'lobby'>('personal');
  const [lobbyMode, setLobbyMode] = useState<'create' | 'join'>('join');
  const [inputId, setInputId] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [friendIdToAdd, setFriendIdToAdd] = useState('');
  const [friendRequests, setFriendRequests] = useState<{userId: string, username: string}[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');

  const {
    inVoice,
    toggleVoice,
    isMuted,
    setIsMuted,
    isDeafened,
    setIsDeafened,
    voiceUsers,
    disconnect
  } = useWebRTC();
  
  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;
    socket.emit("send-message", message);
    setMessage('');
  };
  
  const handleLeave = () => {
    if (socket) {
      socket.emit("leave-room");
    }
    resetRoom();
    disconnect();
  };

  const handleLogout = () => {
    handleLeave();
    logout();
  };

  const handleTabSwitch = (tab: 'personal' | 'lobby') => {
    if (activeTab === tab) return;
    handleLeave(); // leave current room when switching contexts
    setActiveTab(tab);
    setInputId('');
    setInputPass('');
    setError(null);
  };

  const fetchFriends = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/friends/${userId}`);
      const data = await res.json();
      if (data.success) {
        setFriends(data.friends);
      }
      
      const reqRes = await fetch(`/api/friends/requests/${userId}`);
      const reqData = await reqRes.json();
      if (reqData.success) {
        setFriendRequests(reqData.friendRequests);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!friendIdToAdd.trim()) return;

    try {
      const res = await fetch('/api/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId: userId, friendId: friendIdToAdd.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setFriendIdToAdd('');
        fetchFriends(); // Refresh
      } else {
        setError(data.message || 'Failed to add friend');
      }
    } catch (err) {
      setError('Server error');
    }
  };

  const handleAcceptRequest = async (friendId: string) => {
    try {
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId: userId, friendId })
      });
      const data = await res.json();
      if (data.success) fetchFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectRequest = async (friendId: string) => {
    try {
      const res = await fetch('/api/friends/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId: userId, friendId })
      });
      const data = await res.json();
      if (data.success) fetchFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const startChatWithFriend = (friendId: string) => {
    if (!socket || !userId) return;
    setError(null);
    const dmRoomId = [userId, friendId].sort().join('-');
    socket.emit('join-room', { roomId: dmRoomId, username, action: 'personal' });
  };

  const handleJoinAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;
    setError(null);
    
    if (activeTab === 'personal') {
      const targetId = inputId.trim() || Math.random().toString(36).substring(2, 9);
      socket.emit('join-room', { roomId: targetId, username, action: 'personal' });
    } else {
      if (!inputId.trim()) {
        setError('Room ID is required');
        return;
      }
      socket.emit('join-room', { roomId: inputId, password: inputPass, username, action: lobbyMode });
    }
  };

  return (
    <div className="flex h-screen bg-[#1E1F22] text-[#DBDEE1] font-sans overflow-hidden select-none">
      
      {/* 1. Server Sidebar (Navbar) */}
      <div className="w-[72px] bg-[#1E1F22] flex flex-col items-center py-3 gap-2 flex-shrink-0">
        
        {/* Personal Tab */}
        <div 
          onClick={() => handleTabSwitch('personal')}
          className={`w-12 h-12 rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-200 ${activeTab === 'personal' ? 'bg-[#5865F2] text-white rounded-[16px]' : 'bg-[#313338] text-[#DBDEE1] hover:bg-[#5865F2] hover:text-white'}`}
          title="Direct Messages"
        >
          <MessageSquare className="w-6 h-6" />
        </div>

        <div className="w-8 h-0.5 bg-[#313338] rounded my-1" />

        {/* Lobby Tab */}
        <div 
          onClick={() => handleTabSwitch('lobby')}
          className={`w-12 h-12 rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-200 ${activeTab === 'lobby' ? 'bg-[#23A559] text-white rounded-[16px]' : 'bg-[#313338] text-[#DBDEE1] hover:bg-[#23A559] hover:text-white'}`}
          title="Lobby / Groups"
        >
          <Users className="w-6 h-6" />
        </div>

        <div className="w-8 h-0.5 bg-[#313338] rounded my-1" />

        {/* Action icons */}
        {isInRoom && (
          <div 
            onClick={handleLeave}
            className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[#313338] hover:bg-[#F23F42] text-[#23A559] hover:text-white flex items-center justify-center cursor-pointer transition-all duration-200"
            title="Leave Room"
          >
            <PhoneOff className="w-6 h-6" />
          </div>
        )}

        <div className="mt-auto w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[#313338] hover:bg-[#F23F42] text-[#949BA4] hover:text-white flex items-center justify-center cursor-pointer transition-all duration-200"
          onClick={handleLogout}
          title="Log Out"
        >
          <LogOut className="w-6 h-6 ml-1" />
        </div>
      </div>

      {/* 2. Channel Sidebar */}
      <div className="w-60 bg-[#2B2D31] flex flex-col flex-shrink-0 relative">
        {/* Header */}
        <div className="h-12 px-3 flex items-center shadow-sm border-b border-[#1F2124] font-semibold text-white">
          {activeTab === 'personal' ? 'Direct Messages' : 'Lobby'}
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {activeTab === 'lobby' && isInRoom && (
            <>
              {/* Text Channel */}
              <div className="flex items-center space-x-1.5 px-2 py-1.5 rounded hover:bg-[#3F4147] cursor-pointer text-[#DBDEE1] group bg-[#3F4147] mb-4">
                <Hash className="w-5 h-5 text-[#80848E]" />
                <span className="font-medium text-[15px] truncate text-white">general</span>
              </div>

              {/* Voice Channel */}
              <div className="mt-4">
                <div 
                  onClick={() => toggleVoice()}
                  className="flex items-center space-x-1.5 px-2 py-1.5 rounded hover:bg-[#3F4147] cursor-pointer text-[#949BA4] hover:text-[#DBDEE1]"
                >
                  <Volume2 className="w-5 h-5 text-[#80848E]" />
                  <span className="font-medium text-[15px] truncate">Lounge (Voice)</span>
                </div>
                
                {/* Active Voice Users */}
                {inVoice && (
                  <div className="ml-6 mt-1 flex flex-col space-y-1">
                    <div className="flex items-center space-x-2 px-2 py-1 rounded hover:bg-[#3F4147] text-[#DBDEE1] text-[14px]">
                      <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${username}`} alt="Avatar" className="w-6 h-6 rounded-full" />
                      <span className="truncate">{username}</span>
                      {(isMuted || isDeafened) && (
                        <MicOff className="w-3.5 h-3.5 text-[#F23F42] ml-auto" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'personal' && isInRoom && (
            <div className="flex items-center space-x-1.5 px-2 py-1.5 rounded hover:bg-[#3F4147] cursor-pointer text-[#DBDEE1] group bg-[#3F4147]">
              <MessageSquare className="w-5 h-5 text-[#80848E]" />
              <span className="font-medium text-[15px] truncate text-white">Direct {roomId}</span>
            </div>
          )}
          
          {activeTab === 'personal' && !isInRoom && (
            <div className="mt-4 px-2 space-y-4">
              {friendRequests.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase text-[#949BA4] mb-2">Friend Requests</h4>
                  {friendRequests.map((req, i) => (
                    <div key={i} className="flex items-center space-x-2 px-2 py-1.5 rounded bg-[#2B2D31] text-[#DBDEE1] mb-1">
                      <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${req.username}`} alt="Avatar" className="w-6 h-6 rounded-full" />
                      <span className="text-[14px] truncate text-white flex-1">{req.username}</span>
                      <div className="flex space-x-1">
                        <button onClick={() => handleAcceptRequest(req.userId)} className="text-green-500 hover:bg-green-500 hover:text-white p-1 rounded-full bg-[#1E1F22] transition-colors" title="Accept">✓</button>
                        <button onClick={() => handleRejectRequest(req.userId)} className="text-[#F23F42] hover:bg-[#F23F42] hover:text-white p-1 rounded-full bg-[#1E1F22] transition-colors" title="Reject">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <h4 className="text-[11px] font-bold uppercase text-[#949BA4] mb-2">Friends</h4>
                <div className="mb-2">
                  <input
                    type="text"
                    value={friendSearchQuery}
                    onChange={(e) => setFriendSearchQuery(e.target.value)}
                    placeholder="Search by ID or name..."
                    className="w-full bg-[#1E1F22] text-[#DBDEE1] text-[13px] px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
                  />
                </div>
                {friends.length === 0 ? (
                  <div className="text-xs text-[#949BA4] italic text-center py-4">No friends yet. Add them by their Username or 5-digit ID!</div>
                ) : (
                  friends
                    .filter(f => f.username.toLowerCase().includes(friendSearchQuery.toLowerCase()) || f.userId.includes(friendSearchQuery))
                    .map((friend, i) => (
                    <div key={i} onClick={() => startChatWithFriend(friend.userId)} className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-[#3F4147] cursor-pointer text-[#DBDEE1] mb-1">
                      <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${friend.username}`} alt="Avatar" className="w-6 h-6 rounded-full" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] truncate text-white leading-tight">{friend.username}</div>
                        <div className="text-[11px] text-[#949BA4] truncate">ID: {friend.userId}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {!isInRoom && activeTab === 'lobby' && (
            <div className="px-2 py-4 text-sm text-[#949BA4] text-center">
              Join a lobby to see voice and text channels.
            </div>
          )}
        </div>

        {/* User Area */}
        <div className="h-[60px] bg-[#232428] mt-auto flex items-center px-2 space-x-2 group">
          <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${username}`} alt="Avatar" className="w-8 h-8 rounded-full bg-[#1E1F22]" />
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
            navigator.clipboard.writeText(userId);
            alert(`Copied your ID: ${userId}`);
          }} title="Copy ID">
            <div className="text-[13px] font-bold truncate leading-tight text-white">{username}</div>
            <div className="text-[11px] text-[#949BA4] truncate leading-tight group-hover:text-[#DBDEE1] transition-colors">
              # {userId}
            </div>
          </div>
          <div className="flex space-x-1.5">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#3F4147] text-[#B5BAC1]"
            >
              {isMuted ? <MicOff className="w-5 h-5 text-[#F23F42]" /> : <Mic className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsDeafened(!isDeafened)}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#3F4147] text-[#B5BAC1]"
            >
              {isDeafened ? <VolumeX className="w-5 h-5 text-[#F23F42]" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#313338] min-w-0">
        
        {!isInRoom ? (
          // --- NOT IN ROOM: SHOW JOIN/CREATE FORM ---
          <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
            <div className="w-full max-w-md bg-[#2B2D31] p-8 rounded-lg shadow-xl border border-[#1E1F22]">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#5865F2] rounded-full flex items-center justify-center mx-auto mb-4">
                  {activeTab === 'personal' ? <MessageSquare className="w-8 h-8 text-white" /> : <Users className="w-8 h-8 text-white" />}
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {activeTab === 'personal' ? 'Start a Private Chat' : 'Join or Create Lobby'}
                </h2>
                <p className="text-[#949BA4]">
                  {activeTab === 'personal' ? 'Connect directly with a friend.' : 'Hang out with friends in a group.'}
                </p>
              </div>

              {error && (
                <div className="bg-[#F23F42] bg-opacity-20 text-[#FA777C] p-3 rounded mb-6 text-sm font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={activeTab === 'personal' ? handleAddFriend : handleJoinAction} className="space-y-4">
                {activeTab === 'lobby' && (
                  <div className="flex bg-[#1E1F22] rounded p-1 mb-6">
                    <button
                      type="button"
                      onClick={() => setLobbyMode('join')}
                      className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${lobbyMode === 'join' ? 'bg-[#3F4147] text-white shadow' : 'text-[#949BA4] hover:text-[#DBDEE1]'}`}
                    >
                      Join
                    </button>
                    <button
                      type="button"
                      onClick={() => setLobbyMode('create')}
                      className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${lobbyMode === 'create' ? 'bg-[#3F4147] text-white shadow' : 'text-[#949BA4] hover:text-[#DBDEE1]'}`}
                    >
                      Create
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2 tracking-wide">
                    {activeTab === 'personal' ? "Friend's Username or ID" : "Lobby ID"}
                  </label>
                  <input
                    type="text"
                    value={activeTab === 'personal' ? friendIdToAdd : inputId}
                    onChange={(e) => activeTab === 'personal' ? setFriendIdToAdd(e.target.value) : setInputId(e.target.value)}
                    className="w-full bg-[#1E1F22] text-[#DBDEE1] px-3 py-2.5 rounded focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                    placeholder={activeTab === 'personal' ? 'e.g. Username or 12345' : 'Enter Lobby ID'}
                  />
                </div>

                {activeTab === 'lobby' && (
                  <div>
                    <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2 tracking-wide">
                      Password (Optional)
                    </label>
                    <input
                      type="password"
                      value={inputPass}
                      onChange={(e) => setInputPass(e.target.value)}
                      className="w-full bg-[#1E1F22] text-[#DBDEE1] px-3 py-2.5 rounded focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                      placeholder="Leave blank if no password"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold py-3 rounded transition-colors mt-6"
                >
                  {activeTab === 'personal' ? 'Add Friend' : (lobbyMode === 'create' ? 'Create Lobby' : 'Join Lobby')}
                </button>
              </form>
            </div>
          </div>
        ) : (
          // --- IN ROOM: SHOW CHAT ---
          <>
            {/* Header */}
            <div className="h-12 px-4 flex items-center justify-between shadow-sm border-b border-[#26272D] flex-shrink-0">
              <div className="flex items-center gap-2">
                {activeTab === 'personal' ? <MessageSquare className="w-5 h-5 text-[#949BA4]" /> : <Hash className="w-5 h-5 text-[#949BA4]" />}
                <span className="font-bold text-white text-[16px]">{activeTab === 'personal' ? `Chatting in ${roomId}` : 'general'}</span>
              </div>
              
              {/* Top right icons */}
              <div className="flex items-center gap-4 text-[#B5BAC1]">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Invite link copied! Share this exact link with your friends to make sure they join your server.");
                  }}
                  className="px-3 py-1 bg-[#248046] hover:bg-[#1a6334] text-white text-xs font-semibold rounded transition-colors"
                >
                  Copy Invite Link
                </button>
                <div className="flex items-center space-x-1 cursor-pointer hover:text-[#DBDEE1]">
                  <User className="w-5 h-5" />
                  <span className="text-sm font-medium">{users.length}</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Welcome Message */}
              <div className="mt-8 mb-4">
                <div className="w-16 h-16 rounded-full bg-[#4752C4] flex items-center justify-center mb-4 text-white">
                  {activeTab === 'personal' ? <MessageSquare className="w-10 h-10" /> : <Hash className="w-10 h-10" />}
                </div>
                <h1 className="text-[32px] font-bold leading-tight mb-2">
                  {activeTab === 'personal' ? 'Private Chat Started!' : `Welcome to #${roomId}!`}
                </h1>
                <p className="text-[#949BA4] text-[16px]">
                  {activeTab === 'personal' ? `This is the start of your private chat ID: ${roomId}. Send this ID to a friend.` : `This is the start of the #${roomId} channel.`}
                </p>
              </div>

              {messages.map((msg, idx) => {
                const isSequential = idx > 0 && messages[idx - 1].username === msg.username && (msg.timestamp - messages[idx - 1].timestamp) < 300000;
                
                return (
                  <div key={msg.id} className={`group hover:bg-[#2E3035] -mx-4 px-4 py-0.5 relative ${isSequential ? 'mt-1' : 'mt-4'}`}>
                    <div className="flex items-start">
                      {!isSequential ? (
                        <img 
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${msg.username}`} 
                          alt="Avatar" 
                          className="w-10 h-10 rounded-full mr-4 mt-0.5 cursor-pointer hover:opacity-80 transition-opacity bg-[#1E1F22]" 
                        />
                      ) : (
                        <div className="w-10 mr-4 flex-shrink-0 text-[10px] text-[#949BA4] opacity-0 group-hover:opacity-100 text-right pt-2">
                           {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        {!isSequential && (
                          <div className="flex items-baseline space-x-2">
                            <span className="font-medium text-[#DBDEE1] text-[16px] hover:underline cursor-pointer">{msg.username}</span>
                            <span className="text-[12px] text-[#949BA4]">
                              {new Date(msg.timestamp).toLocaleDateString()} {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        <div className="text-[#DBDEE1] text-[15px] leading-[1.375rem] whitespace-pre-wrap break-words">
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="h-[68px] px-4 flex items-center gap-4 bg-[#313338] flex-shrink-0 border-t border-[#383A40]">
              <form 
                onSubmit={handleSendMessage}
                className="flex-1 bg-[#383A40] h-11 rounded-lg flex items-center px-4 gap-4"
              >
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-[#DBDEE1] text-sm placeholder-[#949BA4]"
                  placeholder={activeTab === 'personal' ? 'Message' : 'Message #general'}
                />
                <button 
                  type="submit" 
                  disabled={!message.trim()}
                  className="text-[#949BA4] hover:text-[#DBDEE1] disabled:opacity-50 transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
      
      {/* 4. Right Members Sidebar (Optional, conditionally rendered on larger screens) */}
      {isInRoom && (
        <div className="w-60 bg-[#2B2D31] hidden lg:flex flex-col flex-shrink-0 border-l border-[#26272D]">
          <div className="h-12 px-4 flex items-center font-bold text-white shadow-sm border-b border-[#1F2124]">
            Active Participants ({users.length})
          </div>
          <div className="p-3 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] font-bold uppercase text-[#949BA4] px-2 mb-1">Online — {users.length}</h4>
              {users.map(user => (
              <div key={user.socketId} className="flex items-center space-x-3 px-2 py-1.5 rounded hover:bg-[#3F4147] cursor-pointer group mb-[2px]">
                <div className="relative">
                  <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`} className="w-8 h-8 rounded-full bg-[#1E1F22]" alt="" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] bg-[#2B2D31] group-hover:bg-[#3F4147] rounded-full flex items-center justify-center transition-colors">
                    <div className="w-[10px] h-[10px] bg-[#23A559] rounded-full" />
                  </div>
                </div>
                <span className="text-[#DBDEE1] text-[15px] truncate font-medium group-hover:text-white">
                  {user.username}
                </span>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
