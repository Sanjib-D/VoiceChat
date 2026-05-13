import { create } from 'zustand';

export type Message = {
  id: string;
  text: string;
  username: string;
  timestamp: number;
  roomId: string;
};

export type User = {
  socketId: string;
  username: string;
};

interface AppState {
  isAuthenticated: boolean;
  username: string;
  userId: string;
  friends: { userId: string, username: string }[];
  roomId: string;
  socket: any | null;
  messages: Message[];
  users: User[];
  isConnected: boolean;
  isInRoom: boolean;
  error: string | null;
  
  setIsAuthenticated: (auth: boolean) => void;
  setUsername: (username: string) => void;
  setRoomId: (roomId: string) => void;
  setSocket: (socket: any | null) => void;
  setConnected: (connected: boolean) => void;
  setInRoom: (inRoom: boolean) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  removeUser: (socketId: string) => void;
  setUserId: (userId: string) => void;
  setFriends: (friends: { userId: string, username: string }[]) => void;
  setError: (error: string | null) => void;
  
  resetRoom: () => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  username: '',
  userId: '',
  friends: [],
  roomId: '',
  socket: null,
  messages: [],
  users: [],
  isConnected: false,
  isInRoom: false,
  error: null,
  
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setUsername: (username) => set({ username }),
  setRoomId: (roomId) => set({ roomId }),
  setSocket: (socket) => set({ socket }),
  setConnected: (isConnected) => set({ isConnected }),
  setInRoom: (isInRoom) => set({ isInRoom }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setUsers: (users) => set({ users }),
  addUser: (user) => set((state) => ({ users: [...state.users, user] })),
  removeUser: (socketId) => set((state) => ({ 
    users: state.users.filter(u => u.socketId !== socketId) 
  })),
  setUserId: (userId) => set({ userId }),
  setFriends: (friends) => set({ friends }),
  setError: (error) => set({ error }),
  
  resetRoom: () => set({ 
    isInRoom: false, 
    messages: [], 
    users: [], 
    roomId: '',
    error: null
  }),

  logout: () => set({ 
    isAuthenticated: false,
    username: '',
    userId: '',
    friends: [],
    isInRoom: false, 
    messages: [], 
    users: [], 
    roomId: '',
    error: null
  }),
}));
