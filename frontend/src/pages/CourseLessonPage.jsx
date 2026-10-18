// src/pages/CourseLessonPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { toast } from 'react-hot-toast';

// This is the new, robust ContentViewer that handles all YouTube links
const ContentViewer = ({ url }) => {
    if (url && (url.includes("youtube.com") || url.includes("youtu.be"))) {
        const videoIdMatch = url.match(/(?:v=|\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;

        if (!videoId) {
            return <div className="p-4 bg-red-100 text-red-700 rounded-lg">Could not find a valid YouTube Video ID in the URL.</div>;
        }

        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
        return (
            <div className="aspect-video">
                <iframe
                    className="w-full h-full rounded-lg"
                    src={embedUrl}
                    title="Course Video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
            </div>
        );
    }
    // Fallback for other links (like articles, etc.)
    return (
        <div className="p-4 bg-gray-100 rounded-lg text-center">
            <a href={url} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded transition duration-300 inline-block">
                View External Content
            </a>
            <p className="text-sm text-gray-500 mt-2">This lesson links to an external article or resource.</p>
        </div>
    );
};


export default function CourseLessonPage() {
    const { courseId, lessonId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [currentLesson, setCurrentLesson] = useState(null);
    const [allLessons, setAllLessons] = useState([]);
    const [progress, setProgress] = useState([]);
    const [enrollment, setEnrollment] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!courseId || !user) return;
            setLoading(true);
            try {
                const [lesson, lessons] = await Promise.all([
                    api.getSub('courses', courseId, 'lessons', lessonId).catch(() => null),
                    api.listSub('courses', courseId, 'lessons'),
                ]);
                setCurrentLesson(lesson);
                setAllLessons(lessons);

                if (user.role === 'student') {
                    const mine = await api.list('enrollments', { courseId });
                    if (mine.length > 0) {
                        setEnrollment(mine[0]);
                        setProgress(mine[0].completedLessons || []);
                    }
                }
            } catch (error) {
                console.error("Error fetching lesson data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [courseId, lessonId, user]);

    const handleMarkAsComplete = async () => {
        if (!user) return toast.error("You must be logged in to save progress.");
        const toastId = toast.loading("Saving progress...");
        try {
            if (!enrollment) throw new Error("Enrollment not found");
            const updated = await api.update('enrollments', enrollment.id, {}, { addToSet: { completedLessons: lessonId } });
            setEnrollment(updated);
            setProgress(updated.completedLessons);
            toast.success("Progress saved!", { id: toastId });

            const currentIndex = allLessons.findIndex(l => l.id === lessonId);
            if (currentIndex > -1 && currentIndex < allLessons.length - 1) {
                const nextLesson = allLessons[currentIndex + 1];
                navigate(`/courses/${courseId}/lesson/${nextLesson.id}`);
            }
        } catch (error) {
            console.error("Error updating progress:", error);
            toast.error("Failed to save progress.", { id: toastId });
        }
    };

    if (loading) return <div className="text-center p-10">Loading Classroom...</div>;
    if (!currentLesson) return <div className="text-center p-10">Lesson not found.</div>;

    const isCompleted = progress.includes(lessonId);

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
            <aside className="w-full md:w-80 bg-white p-6 md:h-screen md:sticky md:top-0 border-r border-gray-200">
                <Link to={`/courses/${courseId}`} className="text-sm font-medium text-teal-600 hover:text-teal-800 mb-4 block">&larr; Back to Syllabus</Link>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Course Lessons</h2>
                <ul className="space-y-1">
                    {allLessons.map(lesson => (
                        <li key={lesson.id}>
                            <Link
                                to={`/courses/${courseId}/lesson/${lesson.id}`}
                                className={`block p-3 rounded-md text-sm transition-colors ${lesson.id === lessonId ? 'bg-teal-100 text-teal-800 font-bold' : 'hover:bg-gray-100 text-gray-700'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{lesson.title}</span>
                                    {progress.includes(lesson.id) && <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </aside>

            <main className="flex-1 p-6 sm:p-10">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">{currentLesson.title}</h1>
                    <div className="bg-white p-1 rounded-lg shadow-lg mb-8">
                        <ContentViewer url={currentLesson.contentURL} />
                    </div>
                    {/* === THE BUTTON IS BACK === */}
                    <div className="text-center">
                        <button
                            onClick={handleMarkAsComplete}
                            disabled={isCompleted || !enrollment}
                            className="bg-green-500 text-white font-bold py-3 px-8 rounded-lg transition duration-300 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {isCompleted ? '✓ Completed' : enrollment ? 'Mark as Complete' : 'Enroll to track progress'}
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}