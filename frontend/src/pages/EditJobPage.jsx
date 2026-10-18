import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import toast from 'react-hot-toast';

export default function EditJobPage() {
    const { jobId } = useParams();
    const navigate = useNavigate();
    const [jobData, setJobData] = useState({
        jobTitle: '',
        companyName: '',
        location: '',
        jobType: 'Full-time',
        skills: '',
        description: ''
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchJobData = async () => {
            if (!jobId) return;
            try {
                const data = await api.getDoc('jobs', jobId);
                setJobData({
                    jobTitle: data.jobTitle,
                    companyName: data.companyName,
                    location: data.location,
                    jobType: data.jobType,
                    skills: data.skills.join(', '),
                    description: data.description,
                });
            } catch (error) {
                console.error("Error fetching job data:", error);
                toast.error(error.status === 404 ? "Job not found." : "Failed to load job data.");
                if (error.status === 404 || error.status === 403) navigate('/manage-jobs');
            } finally {
                setLoading(false);
            }
        };
        fetchJobData();
    }, [jobId, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setJobData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading('Updating job...');
        try {
            await api.update('jobs', jobId, {
                ...jobData,
                skills: jobData.skills.split(',').map(skill => skill.trim()).filter(Boolean),
            });
            toast.success('Job updated successfully!', { id: toastId });
            navigate('/manage-jobs');
        } catch (error) {
            console.error("Error updating job:", error);
            toast.error('Failed to update job.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    if (loading && !jobData.jobTitle) {
        return <div className="text-center p-10">Loading job editor...</div>;
    }

    return (
        <div className="w-full max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Edit Job Posting</h1>
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg space-y-6">
                {/* Form fields are the same as PostJobPage, but use jobData state */}
                <div>
                    <label htmlFor="jobTitle" className="block text-gray-700 font-bold mb-2">Job Title</label>
                    <input type="text" name="jobTitle" value={jobData.jobTitle} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                </div>
                <div>
                    <label htmlFor="companyName" className="block text-gray-700 font-bold mb-2">Company Name</label>
                    <input type="text" name="companyName" value={jobData.companyName} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                </div>
                <div>
                    <label htmlFor="location" className="block text-gray-700 font-bold mb-2">Location</label>
                    <input type="text" name="location" value={jobData.location} onChange={handleChange} className="w-full p-2 border rounded-md" required />
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
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}
/* */
