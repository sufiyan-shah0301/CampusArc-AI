// src/pages/CompanyEditorPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';

const pickCompany = (d) => ({ companyName: d.companyName, companyWebsite: d.companyWebsite, industry: d.industry, logoUrl: d.logoUrl, shortDescription: d.shortDescription, aboutSection: d.aboutSection });
import { toast } from 'react-hot-toast';

export default function CompanyEditorPage() {
    const [data, setData] = useState({ companyName: '', companyWebsite: '', industry: '', logoUrl: '', shortDescription: '', aboutSection: '' });
    const [submitting, setSubmitting] = useState(false);
    const { companyId } = useParams();
    const navigate = useNavigate();
    const isEditMode = Boolean(companyId);

    useEffect(() => {
        if (isEditMode) {
            const fetchCompany = async () => {
                try {
                    setData(await api.getDoc('companies', companyId));
                } catch {
                    toast.error("Company profile not found.");
                    navigate('/admin/companies');
                }
            };
            fetchCompany();
        }
    }, [companyId, isEditMode, navigate]);

    const handleChange = (e) => setData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (isEditMode) {
                await api.update('companies', companyId, pickCompany(data));
                toast.success("Company profile updated!");
            } else {
                await api.create('companies', pickCompany(data));
                toast.success("Company profile created!");
            }
            navigate('/admin/companies');
        } catch (error) {
            toast.error("Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">{isEditMode ? 'Edit Company Profile' : 'Create New Company Profile'}</h1>
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md max-w-2xl mx-auto space-y-6">
                <div>
                    <label className="block font-bold mb-2">Company Name</label>
                    <input type="text" name="companyName" value={data.companyName} onChange={handleChange} className="w-full p-2 border rounded" required />
                </div>
                <div>
                    <label className="block font-bold mb-2">Company Website</label>
                    <input type="url" name="companyWebsite" value={data.companyWebsite} onChange={handleChange} className="w-full p-2 border rounded" placeholder="https://..." required />
                </div>
                 <div>
                    <label className="block font-bold mb-2">Industry</label>
                    <input type="text" name="industry" value={data.industry} onChange={handleChange} className="w-full p-2 border rounded" placeholder="e.g., Information Technology" required />
                </div>
                <div>
                    <label className="block font-bold mb-2">Logo URL</label>
                    <input type="url" name="logoUrl" value={data.logoUrl} onChange={handleChange} className="w-full p-2 border rounded" placeholder="https://.../logo.png (optional)" />
                </div>
                <div>
                    <label className="block font-bold mb-2">Short Description</label>
                    <input type="text" name="shortDescription" value={data.shortDescription} onChange={handleChange} className="w-full p-2 border rounded" required />
                </div>
                <div>
                    <label className="block font-bold mb-2">About Section (Markdown supported)</label>
                    <textarea name="aboutSection" value={data.aboutSection} onChange={handleChange} rows="10" className="w-full p-2 border rounded font-mono"></textarea>
                </div>
                <div className="text-right">
                    <button type="submit" disabled={submitting} className="bg-teal-600 text-white font-bold py-2 px-6 rounded disabled:bg-gray-400">
                        {submitting ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </form>
        </div>
    );
}