import React, { useEffect } from 'react';
import io from 'socket.io-client';
import { LoginScreen } from './components/LoginScreen';
import { ChatLayout } from './components/ChatLayout';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const { 
    isAuthenticated,
    isInRoom, 
    setSocket, 
    setConnected, 
    setInRoom, 
    setMessages, 
    addMessage,
    setUsers,
    addUser,
    removeUser,
    setError,
    username,
    roomId,
    setRoomId,
    socket
  } = useAppStore();

  useEffect(() => {
    // Only connect if we don't have a socket yet and we are in dev/prod
    // The server handles socket.io on the same port
    const newSocket = io({
      autoConnect: false,
      transports: ['websocket', 'polling']
    });
    
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });
    
    newSocket.on('error', (err) => {
      setError(err.message || 'An error occurred');
      setInRoom(false);
    });

    newSocket.on('room-joined', ({ roomId, messages, users }) => {
      setRoomId(roomId);
      setMessages(messages);
      setUsers(users);
      setInRoom(true);
    });

    newSocket.on('user-joined', (user) => {
      addUser(user);
    });

    newSocket.on('user-left', (socketId) => {
      removeUser(socketId);
    });

    newSocket.on('new-message', (message) => {
      console.log("[CLIENT] Received new message", message);
      addMessage(message);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && socket && !socket.connected) {
      socket.connect();
    }
  }, [isAuthenticated, socket]);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <ChatLayout />;
}
