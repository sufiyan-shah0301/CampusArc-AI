import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import useLive from '../hooks/useLive';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

// --- Avatar Component ---
const Avatar = ({ name, size = 'md' }) => {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    const sizeClasses = size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-lg';
    return (
        <div className={`flex-shrink-0 ${sizeClasses} flex items-center justify-center rounded-full bg-gradient-to-br from-gray-400 to-gray-600 text-white font-bold`}>
            {initial}
        </div>
    );
};

const ChatRoomPage = () => {
    const { chatId } = useParams();
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatInfo, setChatInfo] = useState(null);

    const scrollableContainerRef = useRef(null);

    useEffect(() => {
        api.getDoc('chats', chatId).then(setChatInfo).catch(() => toast.error("Could not open this conversation."));
    }, [chatId]);

    // new messages arrive over the WebSocket (with a slow poll as a safety net)
    useLive(async () => { setMessages(await api.listSub('chats', chatId, 'messages')); }, `chats/${chatId}/messages`, [chatId], 15000);

    useEffect(() => {
        const container = scrollableContainerRef.current;
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (text === '') return;
        try {
            const sent = await api.createSub('chats', chatId, 'messages', { text });
            setMessages(prev => prev.some(m => m.id === sent.id) ? prev : [...prev, sent]);
            setNewMessage('');
        } catch (error) {
            toast.error("Failed to send message.");
            console.error(error);
        }
    };

    const otherParticipant = chatInfo?.participantInfo.find(p => p.uid !== user?.uid);

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto bg-white shadow-2xl rounded-t-xl border border-gray-200">
            <div className="flex items-center p-4 border-b bg-slate-50 rounded-t-xl">
                <Avatar name={otherParticipant?.name} />
                <div className="ml-4">
                    <h2 className="text-lg font-bold text-slate-800">
                        {otherParticipant?.name || 'Loading...'}
                    </h2>
                    {/* <p className="text-xs text-green-500 font-semibold">Online</p> */} {/* <-- YEH LINE REMOVE KAR DI HAI --> */}
                </div>
            </div>

            <div ref={scrollableContainerRef} className="flex-grow p-6 overflow-y-auto bg-slate-100" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d4d4d8\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }}>
                <div className="flex flex-col space-y-2">
                    {messages.map((msg, index) => {
                        const isSender = msg.senderId === user.uid;
                        const showAvatar = !isSender && (index === 0 || messages[index - 1].senderId !== msg.senderId);
                        
                        return (
                            <div key={msg.id} className={`flex items-end gap-2 ${isSender ? 'justify-end' : 'justify-start'}`}>
                                {showAvatar && <Avatar name={otherParticipant?.name} size="sm" />}
                                {!isSender && !showAvatar && <div className="w-8 flex-shrink-0"></div>}
                                
                                <div className={`max-w-md p-3 rounded-2xl shadow-md ${isSender ? 'bg-gradient-to-br from-teal-500 to-green-500 text-white rounded-br-none' : 'bg-white text-slate-800 rounded-bl-none'}`}>
                                    <p className="text-sm">{msg.text}</p>
                                    <p className={`text-xs mt-1 ${isSender ? 'text-teal-100' : 'text-slate-400'} text-right`}>
                                        {msg.createdAt ? msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sending...'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className="p-4 border-t bg-slate-50">
                <form onSubmit={handleSendMessage} className="flex space-x-3 items-center">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-grow p-3 border-2 border-transparent bg-slate-100 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <button type="submit" className="bg-teal-500 text-white rounded-full p-3 hover:bg-teal-600 transition-colors transform hover:scale-110 shadow-lg">
                        <svg className="w-6 h-6 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatRoomPage;
/* */