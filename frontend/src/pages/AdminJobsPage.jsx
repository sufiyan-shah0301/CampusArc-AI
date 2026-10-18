import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import toast from 'react-hot-toast';

// Helper to get a color based on job status
const getStatusColor = (status) => {
    if (status === 'open') return 'bg-green-100 text-green-800';
    return 'bg-red-100 text-red-800'; // closed
};

const RISK_TONE = { low: 'bg-green-100 text-green-800', medium: 'bg-yellow-100 text-yellow-800', high: 'bg-red-100 text-red-800' };

export default function AdminJobsPage() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        try {
            const [users, jobsList] = await Promise.all([api.list('users'), api.list('jobs')]);
            const usersMap = new Map(users.map(u => [u.id, u.email]));
            const jobsData = jobsList.map(data => ({
                ...data,
                status: data.isOpen ? 'open' : 'closed',
                recruiterEmail: usersMap.get(data.recruiterId) || 'Unknown Recruiter'
            }));

            setJobs(jobsData);
        } catch (error) {
            console.error("Error fetching jobs: ", error);
            toast.error("Failed to load jobs.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    const filteredJobs = useMemo(() => {
        return jobs.filter(job =>
            // FIX: Search using the correct field names 'jobTitle' and 'companyName'
            job.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.recruiterEmail?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [jobs, searchTerm]);

    const handleStatusChange = async (jobId, newStatus) => {
        const toastId = toast.loading("Updating job status...");
        try {
            await api.update('jobs', jobId, { status: newStatus });
            toast.success("Job status updated!", { id: toastId });
            fetchJobs(); // Refresh the list
        } catch (error) {
            toast.error("Failed to update status.", { id: toastId });
            console.error("Error updating status:", error);
        }
    };

    const handleReview = async (jobId, reviewStatus) => {
        const toastId = toast.loading('Saving decision...');
        try {
            await api.update('jobs', jobId, { reviewStatus });
            toast.success(reviewStatus === 'approved' ? 'Job approved and visible to students.' : 'Job rejected and closed.', { id: toastId });
            fetchJobs();
        } catch (error) {
            toast.error(error.message || 'Failed.', { id: toastId });
        }
    };

    const handleDeleteJob = async (jobId) => {
        if (window.confirm("Are you sure you want to delete this job permanently?")) {
            const toastId = toast.loading("Deleting job...");
            try {
                await api.remove('jobs', jobId);
                toast.success("Job deleted successfully!", { id: toastId });
                fetchJobs(); // Refresh the list
            } catch (error) {
                toast.error("Failed to delete job.", { id: toastId });
                console.error("Error deleting job:", error);
            }
        }
    };

    if (loading) {
        return <div className="text-center p-10">Loading all jobs...</div>;
    }

    return (
        <div className="w-full">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Manage All Jobs</h1>
            <div className="mb-6">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by job title, company, or recruiter email..."
                    className="w-full max-w-lg p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                />
            </div>
            <div className="bg-white shadow-lg rounded-lg overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-100">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posted By</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fraud risk (ML)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                    {filteredJobs.map(job => (
                        <tr key={job.id}>
                            {/* FIX: Display data from 'jobTitle' and 'companyName' */}
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{job.jobTitle}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{job.companyName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{job.recruiterEmail}</td>
                            <td className="px-6 py-4 text-sm" title={(job.riskReasons || []).join('; ')}>
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${RISK_TONE[job.riskLevel] || 'bg-gray-100 text-gray-600'}`}>
                                    {job.riskLevel ? `${job.riskLevel} · ${job.riskScore ?? '-'}%` : 'n/a'}
                                </span>
                                {job.reviewStatus === 'pending' && (
                                    <div className="mt-2 space-x-2">
                                        <button onClick={() => handleReview(job.id, 'approved')} className="text-green-700 font-semibold hover:underline">Approve</button>
                                        <button onClick={() => handleReview(job.id, 'rejected')} className="text-red-700 font-semibold hover:underline">Reject</button>
                                    </div>
                                )}
                                {job.reviewStatus && job.reviewStatus !== 'pending' && <div className="text-xs text-gray-500 mt-1">{job.reviewStatus}</div>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(job.status)}`}>
                                    {job.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                <select
                                    onChange={(e) => handleStatusChange(job.id, e.target.value)}
                                    value={job.status}
                                    className="border border-gray-300 rounded-md p-1"
                                >
                                    <option value="open">Open</option>
                                    <option value="closed">Closed</option>
                                </select>
                                <Link to={`/edit-job/${job.id}`} className="text-teal-600 hover:text-teal-900">Edit</Link>
                                <button onClick={() => handleDeleteJob(job.id)} className="text-red-600 hover:text-red-900">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

