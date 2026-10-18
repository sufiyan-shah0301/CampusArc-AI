import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import toast from 'react-hot-toast';

export default function PostJobPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [jobData, setJobData] = useState({
        jobTitle: '',
        companyName: '',
        location: '',
        jobType: 'Full-time',
        skills: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setJobData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            toast.error("You must be logged in to post a job.");
            return;
        }
        setLoading(true);
        const toastId = toast.loading('Posting job...');
        try {
            const created = await api.create('jobs', {
                ...jobData,
                skills: jobData.skills.split(',').map(skill => skill.trim()).filter(Boolean),
            });
            if (created.riskLevel === 'high') {
                toast.error(`Posted, but our fraud screening flagged it (${created.riskScore}% risk). It stays hidden from students until an admin reviews it. ${created.riskReasons?.[0] || ''}`, { id: toastId, duration: 9000 });
            } else {
                toast.success(created.riskLevel === 'medium' ? 'Job posted. Note: it looks slightly unusual, so add more detail to build trust.' : 'Job posted successfully!', { id: toastId });
            }
            navigate('/manage-jobs');
        } catch (error) {
            console.error("Error posting job:", error);
            toast.error('Failed to post job.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Post a New Job</h1>
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg space-y-6">
                <div>
                    <label htmlFor="jobTitle" className="block text-gray-700 font-bold mb-2">Job Title</label>
                    <input type="text" name="jobTitle" value={jobData.jobTitle} onChange={handleChange} className="w-full p-2 border rounded-md" placeholder="e.g., Senior React Developer" required />
                </div>
                <div>
                    <label htmlFor="companyName" className="block text-gray-700 font-bold mb-2">Company Name</label>
                    <input type="text" name="companyName" value={jobData.companyName} onChange={handleChange} className="w-full p-2 border rounded-md" placeholder="e.g., Acme Corporation" required />
                </div>
                <div>
                    <label htmlFor="location" className="block text-gray-700 font-bold mb-2">Location</label>
                    <input type="text" name="location" value={jobData.location} onChange={handleChange} className="w-full p-2 border rounded-md" placeholder="e.g., Mumbai, India" required />
                </div>
                <div>
                    <label htmlFor="jobType" className="block text-gray-700 font-bold mb-2">Job Type</label>
                    <select name="jobType" value={jobData.jobType} onChange={handleChange} className="w-full p-2 border rounded-md">
                        <option>Full-time</option>
                        <option>Part-time</option>
                        <option>Internship</option>
                        <option>Contract</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="skills" className="block text-gray-700 font-bold mb-2">Required Skills</label>
                    <input type="text" name="skills" value={jobData.skills} onChange={handleChange} className="w-full p-2 border rounded-md" placeholder="e.g., React, Python, C++" required />
                    <p className="text-xs text-gray-500 mt-1">Please provide a comma-separated list of skills.</p>
                </div>
                <div>
                    <label htmlFor="description" className="block text-gray-700 font-bold mb-2">Job Description</label>
                    <textarea name="description" value={jobData.description} onChange={handleChange} rows="6" className="w-full p-2 border rounded-md" required></textarea>
                </div>
                <div className="text-center">
                    <button type="submit" disabled={loading} className="bg-teal-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-teal-700 disabled:bg-gray-400">
                        {loading ? 'Posting...' : 'Post Job'}
                    </button>
                </div>
            </form>
        </div>
    );
}

/* */