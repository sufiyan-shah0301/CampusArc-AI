// src/pages/CompanyDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { Avatar } from '../components/dashboard/parts.jsx';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import ReactMarkdown from 'react-markdown';

export default function CompanyDetailPage() {
    const { companyId } = useParams();
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCompany = async () => {
            try { setCompany(await api.getDoc('companies', companyId)); } catch { setCompany(null); }
            setLoading(false);
        };
        fetchCompany();
    }, [companyId]);

    if (loading) return <div className="text-center p-10">Loading Profile...</div>;
    if (!company) return <div className="text-center p-10">Company Profile not found.</div>;

    return (
        <div className="container mx-auto p-8">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
                <div className="flex flex-col sm:flex-row items-start gap-8">
                    <Avatar name={company.companyName} src={company.logoUrl} className="h-24 w-24 text-4xl" />
                    <div>
                        <h1 className="text-4xl font-bold">{company.companyName}</h1>
                        <a href={company.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">{company.companyWebsite}</a>
                    </div>
                </div>
                <hr className="my-8"/>
                <article className="prose lg:prose-xl max-w-none">
                    <ReactMarkdown>{company.aboutSection}</ReactMarkdown>
                </article>
            </div>
        </div>
    );
}