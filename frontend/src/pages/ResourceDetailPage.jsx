// src/pages/ResourceDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import ReactMarkdown from 'react-markdown';

export default function ResourceDetailPage() {
    const { resourceId } = useParams();
    const [resource, setResource] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchResource = async () => {
            setLoading(true);
            try { setResource(await api.getDoc('resources', resourceId)); } catch { setResource(null); }
            setLoading(false);
        };
        fetchResource();
    }, [resourceId]);

    if (loading) return <div className="text-center p-10">Loading Article...</div>;
    if (!resource) return <div className="text-center p-10">Article not found.</div>;

    return (
        <div className="bg-white py-12">
            <div className="max-w-3xl mx-auto px-6">
                <Link to="/resources" className="text-teal-600 font-semibold hover:text-teal-800 mb-8 inline-block">&larr; Back to Resource Library</Link>

                <header className="mb-8">
                    <span className="inline-block bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm font-semibold mb-3">{resource.category}</span>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight">{resource.title}</h1>
                </header>

                {/* The 'prose' class beautifully styles your markdown content */}
                <article className="prose lg:prose-xl max-w-none prose-teal">
                    <ReactMarkdown>{resource.content}</ReactMarkdown>
                </article>
            </div>
        </div>
    );
}