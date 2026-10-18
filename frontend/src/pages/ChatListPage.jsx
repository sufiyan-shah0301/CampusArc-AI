import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import useLive from '../hooks/useLive';
import { useAuth } from '../contexts/AuthContext';
import { Link, useParams } from 'react-router-dom';

// === AVATAR COMPONENT (COLORFUL) ===
const Avatar = ({ name }) => {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return (
        <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-green-600 text-white text-xl font-bold">
            {initial}
        </div>
    );
};

// === WELCOME/EMPTY STATE COMPONENT ===
const WelcomePanel = () => (
    <div className="hidden md:flex flex-col items-center justify-center h-full bg-gray-50 rounded-r-xl p-8 text-center">
        
        <h2 className="mt-4 text-2xl font-bold text-gray-800">Welcome to Your Messages</h2>
        <p className="mt-2 text-gray-500">Select a conversation from the left to start chatting.</p>
    </div>
);

const ChatListPage = () => {
    const { user } = useAuth();
    const { chatId } = useParams();
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);

    useLive(async () => {
        try {
            setChats(await api.list('chats'));
        } catch (error) {
            console.error("Error fetching chats:", error);
        }
        setLoading(false);
    }, 'chats', [user?.uid]);

    if (loading) {
        return <div className="text-center p-10">Loading chats...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto py-8">
            <div className="h-[calc(100vh-120px)] flex bg-white shadow-2xl rounded-xl border border-gray-200">
                
                <div className="w-full md:w-1/3 border-r border-gray-200 flex flex-col">
                    <div className="p-4 border-b">
                        <h1 className="text-2xl font-bold text-slate-800">Conversations</h1>
                    </div>
                    
                    <ul className="overflow-y-auto flex-grow">
                        {chats.length > 0 ? (
                            chats.map(chat => {
                                const otherParticipant = chat.participantInfo?.find(p => p.uid !== user.uid);
                                const isActive = chat.id === chatId;
                                return (
                                    <li key={chat.id}>
                                        <Link 
                                            to={`/chat/${chat.id}`} 
                                            className={`flex items-center p-4 transition-colors duration-200 ${isActive ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                                        >
                                            <Avatar name={otherParticipant?.name} />
                                            <div className="ml-4 flex-grow overflow-hidden">
                                                <p className="text-md font-bold text-slate-900">{otherParticipant?.name || 'Unknown User'}</p>
                                                <p className="text-sm text-slate-500 truncate mt-1">
                                                    {chat.lastMessage?.text || 'No messages yet...'}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end ml-2">
                                                <span className="text-xs text-slate-400 mb-2">
                                                    {chat.updatedAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {/* <span className="h-2 w-2 bg-blue-500 rounded-full"></span> */} {/* <-- YEH LINE REMOVE KAR DI HAI --> */}
                                            </div>
                                        </Link>
                                    </li>
                                )
                            })
                        ) : (
                            <li className="text-center text-slate-500 p-12">
                                <h3 className="text-lg font-semibold">No Conversations Yet</h3>
                            </li>
                        )}
                    </ul>
                </div>
                
                <div className="hidden md:block flex-grow">
                    <WelcomePanel />
                </div>

            </div>
        </div>
    );
};

export default ChatListPage;