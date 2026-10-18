import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import toast from 'react-hot-toast';

export default function AdminCoursesPage() {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCourses = async () => {
        if (!user) return;

        try {
            setCourses(await api.list('courses'));
        } catch (error) {
            console.error("Error fetching courses: ", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourses();
        // THE FIX: Depend on the user's stable UID, not the entire user object.
    }, [user?.uid]);

    const handleDelete = async (courseId) => {
        if (window.confirm("Are you sure you want to delete this course? This action cannot be undone.")) {
            const toastId = toast.loading("Deleting course...");
            try {
                await api.remove('courses', courseId);
                toast.success("Course deleted successfully!", { id: toastId });
                fetchCourses();
            } catch (error) {
                toast.error("Failed to delete course.", { id: toastId });
                console.error("Error deleting course: ", error);
            }
        }
    };

    if (loading) {
        return <div className="text-center p-10">Loading courses...</div>;
    }

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Manage Courses</h1>
                <Link to="/admin/courses/new" className="bg-teal-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-teal-700">
                    + Add New Course
                </Link>
            </div>
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-100">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                    {courses.map(course => (
                        <tr key={course.id}>
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{course.title}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">{course.tags.join(', ')}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                <Link to={`/admin/courses/edit/${course.id}`} className="text-teal-600 hover:text-teal-900">Edit</Link>
                                <button onClick={() => handleDelete(course.id)} className="text-red-600 hover:text-red-900">Delete</button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

