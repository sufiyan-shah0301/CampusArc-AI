import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import useLive from '../hooks/useLive';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// --- Icons ---
const PlusIcon = () => (<svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>);
const LocationIcon = () => (<svg className="w-5 h-5 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const UsersIcon = () => (<svg className="w-5 h-5 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 11a4 4 0 110-5.292" /></svg>);

const ManageJobsPage = () => {
    const { user } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useLive(async () => {
        setJobs(await api.get('/api/recruiter/jobs'));
        setLoading(false);
    }, 'jobs', [user?.uid]);

    const handleStatusToggle = async (jobId, currentStatus) => {
        const newStatus = currentStatus === 'open' ? 'closed' : 'open';
        try {
            await api.update('jobs', jobId, { status: newStatus });
            toast.success(`Job status changed to ${newStatus}`);
        } catch (error) {
            toast.error("Failed to update status.");
            console.error(error);
        }
    };

    if (loading) return <div className="text-center p-10">Loading Your Job Postings...</div>;

    return (
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Manage Your Job Postings</h1>
                <Link to="/post-job" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700">
                    <PlusIcon /> Post a New Job
                </Link>
            </div>
            
            <div className="space-y-6">
                {jobs.length > 0 ? jobs.map(job => (
                    <div key={job.id} className="bg-white shadow-md rounded-lg p-6 flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div className="flex-grow">
                            <h2 className="text-xl font-bold text-gray-800">{job.jobTitle}
                                {job.reviewStatus === 'pending' && <span className="ml-3 align-middle text-xs font-bold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800" title={(job.riskReasons || []).join('; ')}>Under admin review</span>}
                                {job.reviewStatus === 'rejected' && <span className="ml-3 align-middle text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-800">Rejected</span>}
                            </h2>
                            <div className="flex items-center text-sm text-gray-500 mt-2">
                                <LocationIcon /> {job.location}
                                <span className="mx-2">|</span>
                                <UsersIcon /> {job.applicantCount} Applicants
                            </div>
                        </div>
                        <div className="flex items-center space-x-4 mt-4 md:mt-0">
                            <div className="flex items-center space-x-2">
                                <span className={`text-sm font-medium ${job.status === 'open' ? 'text-green-600' : 'text-gray-500'}`}>{job.status === 'open' ? 'Open' : 'Closed'}</span>
                                <button onClick={() => handleStatusToggle(job.id, job.status)} className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 ${job.status === 'open' ? 'bg-teal-600' : 'bg-gray-200'}`}>
                                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${job.status === 'open' ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            <Link to={`/edit-job/${job.id}`} className="text-sm font-medium text-gray-600 hover:text-gray-900">Edit</Link>
                            <Link to={`/jobs/${job.id}/applicants`} className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700">View Applicants</Link>
                        </div>
                    </div>
                )) : (
                    <div className="text-center text-gray-500 bg-white p-12 rounded-lg shadow-md">
                        <p>You have not posted any jobs yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageJobsPage;