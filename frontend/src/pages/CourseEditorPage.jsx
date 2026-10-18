// src/pages/CourseEditorPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

const pickCourse = (c) => ({ title: c.title, shortDescription: c.shortDescription, longDescription: c.longDescription, tags: c.tags });
import { toast } from 'react-hot-toast';

// This is a new component for the pop-up modal form
const LessonModal = ({ isOpen, onClose, onSave, currentLesson }) => {
    const [lessonData, setLessonData] = useState({ title: '', contentURL: '' });

    useEffect(() => {
        if (currentLesson) {
            setLessonData(currentLesson);
        } else {
            setLessonData({ title: '', contentURL: '' });
        }
    }, [currentLesson]);
    
    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setLessonData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        if (!lessonData.title || !lessonData.contentURL) {
            return toast.error("Both title and URL are required.");
        }
        onSave(lessonData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <h2 className="text-2xl font-bold mb-4">{currentLesson ? 'Edit Lesson' : 'Add New Lesson'}</h2>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-gray-700 font-bold mb-1">Lesson Title</label>
                        <input
                            type="text" name="title" id="title" value={lessonData.title} onChange={handleChange}
                            className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., Introduction to Hooks"
                        />
                    </div>
                    <div>
                        <label htmlFor="contentURL" className="block text-gray-700 font-bold mb-1">Content URL</label>
                        <input
                            type="text" name="contentURL" id="contentURL" value={lessonData.contentURL} onChange={handleChange}
                            className="w-full px-3 py-2 border rounded-lg" placeholder="e.g., https://www.youtube.com/watch?v=..."
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                    <button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded">Cancel</button>
                    <button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded">Save Lesson</button>
                </div>
            </div>
        </div>
    );
};


export default function CourseEditorPage() {
    // --- State for the main course form ---
    const [courseData, setCourseData] = useState({ title: '', shortDescription: '', longDescription: '', tags: [] });
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // --- New state for lesson management ---
    const [lessons, setLessons] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentLesson, setCurrentLesson] = useState(null); // Used for editing a specific lesson

    const navigate = useNavigate();
    const { courseId } = useParams();
    const isEditMode = Boolean(courseId);

    // Effect to fetch main course data AND its lessons
    useEffect(() => {
        if (isEditMode) {
            const fetchCourseAndLessons = async () => {
                setLoading(true);
                try {
                    setCourseData(await api.getDoc('courses', courseId));
                    setLessons(await api.listSub('courses', courseId, 'lessons'));
                } catch (error) {
                    toast.error("Course not found.");
                    navigate('/admin/courses');
                    return;
                }

                setLoading(false);
            };
            fetchCourseAndLessons();
        }
    }, [courseId, isEditMode, navigate]);

    const handleLessonSave = async (lessonData) => {
        const lessonToast = toast.loading("Saving lesson...");
        try {
            const payload = { title: lessonData.title, contentURL: lessonData.contentURL };
            if (currentLesson && currentLesson.id) {
                await api.updateSub('courses', courseId, 'lessons', currentLesson.id, payload);
            } else {
                await api.createSub('courses', courseId, 'lessons', payload);
            }
            setLessons(await api.listSub('courses', courseId, 'lessons'));

            toast.success("Lesson saved!", { id: lessonToast });
            setIsModalOpen(false);
            setCurrentLesson(null);
        } catch (error) {
            console.error("Error saving lesson:", error);
            toast.error("Failed to save lesson.", { id: lessonToast });
        }
    };

    const handleLessonDelete = async (lessonId) => {
        if (window.confirm("Are you sure you want to delete this lesson?")) {
            const lessonToast = toast.loading("Deleting lesson...");
            try {
                await api.removeSub('courses', courseId, 'lessons', lessonId);
                setLessons(lessons.filter(l => l.id !== lessonId)); // Update UI instantly
                toast.success("Lesson deleted!", { id: lessonToast });
            } catch (error) {
                console.error("Error deleting lesson:", error);
                toast.error("Failed to delete lesson.", { id: lessonToast });
            }
        }
    };

    // --- Functions for the main course form (no changes) ---
    const handleChange = (e) => setCourseData(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleTagsChange = (e) => setCourseData(p => ({ ...p, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }));
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!courseData.title) return toast.error("Title is required.");
        setSubmitting(true);
        const toastId = toast.loading(isEditMode ? "Updating course..." : "Creating course...");
        try {
            if (isEditMode) {
                await api.update('courses', courseId, pickCourse(courseData));
            } else {
                await api.create('courses', pickCourse(courseData));
            }
            toast.success(`Course ${isEditMode ? 'updated' : 'created'} successfully!`, { id: toastId });
            navigate('/admin/courses');
        } catch (error) {
            toast.error(`Failed to save course.`, { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && isEditMode) return <div className="text-center p-10">Loading course for editing...</div>;

    return (
        <>
            <LessonModal 
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setCurrentLesson(null); }}
                onSave={handleLessonSave}
                currentLesson={currentLesson}
            />
            <div className="container mx-auto p-8">
                {/* --- MAIN COURSE DETAILS FORM (no changes) --- */}
                <h1 className="text-3xl font-bold mb-6">{isEditMode ? 'Edit Course' : 'Create New Course'}</h1>
                <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md max-w-2xl mx-auto">
                    {/* Input fields for title, descriptions, tags... */}
                    <div className="mb-4">
                        <label htmlFor="title" className="block text-gray-700 font-bold mb-2">Title</label>
                        <input type="text" name="title" id="title" value={courseData.title} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="shortDescription" className="block text-gray-700 font-bold mb-2">Short Description</label>
                        <input type="text" name="shortDescription" id="shortDescription" value={courseData.shortDescription} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg" />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="longDescription" className="block text-gray-700 font-bold mb-2">Long Description</label>
                        <textarea name="longDescription" id="longDescription" value={courseData.longDescription} onChange={handleChange} rows="6" className="w-full px-3 py-2 border rounded-lg"></textarea>
                    </div>
                    <div className="mb-6">
                        <label htmlFor="tags" className="block text-gray-700 font-bold mb-2">Tags</label>
                        <input type="text" name="tags" id="tags" value={courseData.tags.join(', ')} onChange={handleTagsChange} className="w-full px-3 py-2 border rounded-lg" />
                    </div>
                    <div className="text-right">
                        <button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-6 rounded transition duration-300 disabled:bg-gray-400">
                            {submitting ? 'Saving...' : 'Save Course'}
                        </button>
                    </div>
                </form>

                {/* --- NEW LESSON MANAGEMENT SECTION --- */}
                {isEditMode && (
                    <div className="bg-white p-8 rounded-lg shadow-md max-w-2xl mx-auto mt-10">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold">Manage Lessons</h2>
                            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                                + Add Lesson
                            </button>
                        </div>
                        <ul className="divide-y divide-gray-200">
                            {lessons.map(lesson => (
                                <li key={lesson.id} className="py-3 flex justify-between items-center">
                                    <span className="font-medium">{lesson.title}</span>
                                    <div className="flex gap-4">
                                        <button onClick={() => { setCurrentLesson(lesson); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800">Edit</button>
                                        <button onClick={() => handleLessonDelete(lesson.id)} className="text-red-600 hover:text-red-800">Delete</button>
                                    </div>
                                </li>
                            ))}
                            {lessons.length === 0 && <p className="text-gray-500">No lessons have been added yet.</p>}
                        </ul>
                    </div>
                )}
            </div>
        </>
    );
}