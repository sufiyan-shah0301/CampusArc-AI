import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import useLive from '../hooks/useLive';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// --- Student Avatar ---
const StudentAvatar = ({ name }) => {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-gray-300 text-gray-600 font-bold">{initial}</div>;
};

const LiveQnaHostPage = ({ session }) => {
    const [unansweredQuestions, setUnansweredQuestions] = useState([]);
    const [answeredQuestions, setAnsweredQuestions] = useState([]);
    const [sessionStatus, setSessionStatus] = useState(session.status);
    const [answerText, setAnswerText] = useState('');
    const [answeringQuestionId, setAnsweringQuestionId] = useState(null);

    useLive(async () => {
        const [questions, s] = await Promise.all([
            api.listSub('qna_sessions', session.id, 'questions'),
            api.getDoc('qna_sessions', session.id),
        ]);
        setUnansweredQuestions(questions.filter(q => !q.isAnswered));
        setAnsweredQuestions(questions.filter(q => q.isAnswered).reverse());
        setSessionStatus(s.status);
    }, `qna_sessions/${session.id}/questions`, [session.id], 8000);

    const handleUpdateStatus = async (newStatus) => {
        try {
            await api.update('qna_sessions', session.id, { status: newStatus });
            setSessionStatus(newStatus);
            toast.success(`Session is now ${newStatus}!`);
        } catch (error) {
            toast.error('Could not update the session.');
        }
    };

    const handleAnswerSubmit = async (e) => {
        e.preventDefault();
        if (!answerText.trim()) return;
        const toastId = toast.loading('Publishing answer...');
        try {
            await api.updateSub('qna_sessions', session.id, 'questions', answeringQuestionId, { answerText, isAnswered: true });
            toast.success('Answer published!', { id: toastId });
            setAnsweringQuestionId(null);
            setAnswerText('');
        } catch (error) {
            toast.error('Failed to publish answer.', { id: toastId });
        }
    };

    const StatusBadge = ({ status }) => {
        const styles = {
            scheduled: 'bg-blue-100 text-blue-800',
            live: 'bg-red-100 text-red-800 animate-pulse',
            ended: 'bg-gray-100 text-gray-800',
        };
        return <span className={`px-3 py-1 text-sm font-semibold rounded-full ${styles[status]}`}>{status.toUpperCase()}</span>;
    };

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto py-8 px-4">
                <div className="bg-white p-6 rounded-xl shadow-lg border-b-4 border-teal-500 mb-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div>
                            <h1 className="text-3xl font-black text-slate-800">{session.topic}</h1>
                            <p className="text-slate-500">You are hosting this session.</p>
                        </div>
                        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
                            <StatusBadge status={sessionStatus} />
                            {sessionStatus === 'scheduled' && <button onClick={() => handleUpdateStatus('live')} className="bg-green-500 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-green-600 transition-all transform hover:scale-105">Go Live</button>}
                            {sessionStatus === 'live' && <button onClick={() => handleUpdateStatus('ended')} className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-red-600 transition-all transform hover:scale-105">End Session</button>}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Unanswered Questions Column */}
                    <div>
                        <h2 className="text-2xl font-bold mb-4 text-slate-700">Incoming Questions ({unansweredQuestions.length})</h2>
                        <div className="bg-white p-4 rounded-xl shadow-lg h-[60vh] overflow-y-auto space-y-4">
                            {unansweredQuestions.length > 0 ? unansweredQuestions.map(q => (
                                <div key={q.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <div className="flex items-start">
                                        <StudentAvatar name={q.studentName} />
                                        <div className="ml-3">
                                            <p className="text-sm font-bold text-slate-800">{q.studentName}</p>
                                            <p className="text-md text-slate-700 mt-1">{q.text}</p>
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                    {answeringQuestionId === q.id ? (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                            <form onSubmit={handleAnswerSubmit} className="mt-3 pl-13">
                                                <textarea value={answerText} onChange={e => setAnswerText(e.target.value)} className="w-full p-2 border rounded-md" placeholder="Type your answer..."></textarea>
                                                <div className="flex justify-end space-x-2 mt-2">
                                                    <button type="button" onClick={() => setAnsweringQuestionId(null)} className="text-sm px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
                                                    <button type="submit" className="text-sm px-3 py-1 rounded bg-teal-600 text-white hover:bg-teal-700">Publish</button>
                                                </div>
                                            </form>
                                        </motion.div>
                                    ) : (
                                        <div className="text-right mt-2">
                                            <button onClick={() => { setAnsweringQuestionId(q.id); setAnswerText(''); }} className="text-sm font-semibold text-teal-600 hover:text-teal-800">Answer</button>
                                        </div>
                                    )}
                                    </AnimatePresence>
                                </div>
                            )) : <p className="text-center text-gray-500 pt-10">No new questions yet...</p>}
                        </div>
                    </div>

                    {/* Answered Questions Column */}
                    <div>
                        <h2 className="text-2xl font-bold mb-4 text-slate-700">Published Q&A ({answeredQuestions.length})</h2>
                        <div className="bg-white p-4 rounded-xl shadow-lg h-[60vh] overflow-y-auto space-y-4">
                            {answeredQuestions.length > 0 ? answeredQuestions.map(q => (
                                <div key={q.id} className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                                    <div>
                                        <p className="text-sm text-gray-500 font-semibold flex items-center"><StudentAvatar name={q.studentName} /> <span className="ml-2">{q.studentName} asked:</span></p>
                                        <p className="text-gray-800 my-2 pl-12">{q.text}</p>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-teal-200">
                                        <p className="text-sm text-teal-700 font-bold">Your Answer:</p>
                                        <p className="text-gray-700 whitespace-pre-wrap">{q.answerText}</p>
                                    </div>
                                </div>
                            )) : <p className="text-center text-gray-500 pt-10">You haven't answered any questions yet.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveQnaHostPage;