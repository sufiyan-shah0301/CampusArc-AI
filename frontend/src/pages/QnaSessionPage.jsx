import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

import LiveQnaHostPage from './LiveQnaHostPage';
import LiveQnaGuestPage from './LiveQnaGuestPage';

const QnaSessionPage = () => {
    const { sessionId } = useParams();
    const { user } = useAuth();

    const [sessionData, setSessionData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!sessionId) return;

        const fetchSession = async () => {
            try {
                setSessionData(await api.getDoc('qna_sessions', sessionId));
            } catch (err) {
                console.error("Error fetching session:", err);
                setError(err.status === 404 ? 'Session not found.' : 'Failed to load session details.');
            } finally {
                setLoading(false);
            }
        };

        fetchSession();
    }, [sessionId]);

    if (loading) {
        return <div className="text-center p-10">Loading Session...</div>;
    }

    if (error) {
        return <div className="text-center p-10 text-red-500">{error}</div>;
    }

    const isHost = user && sessionData && user.uid === sessionData.recruiterId;

    return isHost ? (
        <LiveQnaHostPage session={sessionData} />
    ) : (
        <LiveQnaGuestPage session={sessionData} />
    );
};

export default QnaSessionPage;