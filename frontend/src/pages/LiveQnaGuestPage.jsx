import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import useLive from '../hooks/useLive';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

// --- Avatar Components ---
const UserAvatar = ({ name }) => {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-gray-300 text-gray-600 font-bold">{initial}</div>;
};
const HostAvatar = ({ name }) => {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-teal-500 text-white font-bold">{initial}</div>;
};

const LiveQnaGuestPage = ({ session: initialSession }) => {
    const { user } = useAuth();
    const [session, setSession] = useState(initialSession);
    const [questions, setQuestions] = useState([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useLive(async () => {
        const [s, qs] = await Promise.all([
            api.getDoc('qna_sessions', initialSession.id),
            api.listSub('qna_sessions', initialSession.id, 'questions'),
        ]);
        setSession(s);
        setQuestions(qs.filter(q => q.isAnswered));
    }, `qna_sessions/${initialSession.id}/questions`, [initialSession.id], 8000);

    const handleAskQuestion = async (e) => {
        e.preventDefault();
        if (newQuestion.trim() === '') return toast.error("Question cannot be empty.");
        setIsSubmitting(true);
        try {
            await api.createSub('qna_sessions', session.id, 'questions', { text: newQuestion.trim() });
            toast.success("Your question has been submitted to the host!");
            setNewQuestion('');
        } catch (error) {
            console.error("Error submitting question:", error);
            toast.error(error.message || "Failed to submit your question.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderFormOrStatus = () => {
        switch (session.status) {
            case 'live':
                return (
                    <form onSubmit={handleAskQuestion} className="flex space-x-3 items-center">
                        <input
                            type="text" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)}
                            placeholder="Type your question here..."
                            className="flex-grow p-3 border-2 border-transparent bg-slate-100 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500"
                            disabled={isSubmitting}
                        />
                        <button type="submit" disabled={isSubmitting} className="bg-teal-500 text-white rounded-full p-3 hover:bg-teal-600 transition-colors transform hover:scale-110 shadow-lg disabled:bg-gray-400">
                            <svg className="w-6 h-6 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </form>
                );
            case 'scheduled':
                return <p className="text-center text-slate-500 font-semibold p-4 bg-blue-50 rounded-lg">This session has not started yet. Please wait for the host to go live.</p>;
            case 'ended':
                return <p className="text-center text-slate-500 font-semibold p-4 bg-gray-100 rounded-lg">This session has ended. Thank you for participating!</p>;
            default:
                return null;
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="max-w-4xl mx-auto py-8 px-4 flex flex-col h-[calc(100vh-80px)]">
                <div className="text-center mb-6 pb-4 border-b-2 border-slate-200 relative">
                    {session.status === 'live' && <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">LIVE</span>}
                    <p className="text-sm text-teal-600 font-semibold">LIVE Q&A SESSION</p>
                    <h1 className="text-3xl font-black text-slate-800">{session.topic}</h1>
                    <p className="text-slate-500">Hosted by: {session.recruiterName}</p>
                </div>
                <div className="flex-grow overflow-y-auto pr-4 space-y-6">
                    <AnimatePresence>
                        {questions.length > 0 ? (
                            questions.map(q => (
                                <motion.div 
                                    key={q.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="bg-white p-4 rounded-xl shadow-md border border-gray-200"
                                >
                                    <div className="flex items-start space-x-3">
                                        <UserAvatar name={q.studentName} />
                                        <div>
                                            <p className="font-semibold text-gray-700">{q.studentName}</p>
                                            <p className="text-gray-800 my-1">{q.text}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-dashed ml-12">
                                        <div className="flex items-start space-x-3">
                                            <HostAvatar name={session.recruiterName} />
                                            <div>
                                                <p className="font-semibold text-teal-700">{session.recruiterName}</p>
                                                <p className="text-gray-700 whitespace-pre-wrap">{q.answerText}</p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="text-center text-gray-400 pt-16">
                                                                <p className="mt-4 font-semibold">
                                    {session.status === 'live' ? 'No questions have been answered yet. Be the first to ask one!' : 'The Q&A will appear here once the session is live.'}
                                </p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
                <div className="mt-6 pt-4 border-t">
                    {renderFormOrStatus()}
                </div>
            </div>
        </div>
    );
};

export default LiveQnaGuestPage;