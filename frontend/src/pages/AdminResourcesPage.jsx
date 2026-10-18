// src/pages/AdminResourcesPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from 'react-hot-toast';

export default function AdminResourcesPage() {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchResources = async () => {
        setResources(await api.list('resources'));
        setLoading(false);
    };

    useEffect(() => {
        fetchResources();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this resource?")) {
            await api.remove('resources', id);
            toast.success("Resource deleted!");
            fetchResources(); // Refresh list
        }
    };

    if (loading) return <div className="text-center p-10">Loading...</div>;

    return (
        <div className="container mx-auto p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Manage Resources</h1>
                <Link to="/admin/resources/new" className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded">
                    + Add New Resource
                </Link>
            </div>
            <div className="bg-white shadow-md rounded-lg">
                <ul>
                    {resources.map(resource => (
                        <li key={resource.id} className="p-4 flex justify-between items-center border-b last:border-b-0">
                            <div>
                                <p className="font-semibold">{resource.title}</p>
                                <p className="text-sm text-gray-500">{resource.category}</p>
                            </div>
                            <div className="flex gap-4">
                                <Link to={`/admin/resources/edit/${resource.id}`} className="text-blue-600 font-semibold">Edit</Link>
                                <button onClick={() => handleDelete(resource.id)} className="text-red-600 font-semibold">Delete</button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}