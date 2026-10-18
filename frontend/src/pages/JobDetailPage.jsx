import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import CoverLetterPanel from '../components/CoverLetterPanel';
import { useAuth } from '../contexts/AuthContext';
import { BriefcaseIcon } from '../components/Icons';

export default function JobDetailPage() {
    const { user } = useAuth();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isApplying, setIsApplying] = useState(false);
    const [isApplied, setIsApplied] = useState(false);
    const [similar, setSimilar] = useState([]);
    const [coverLetter, setCoverLetter] = useState('');
    const { jobId } = useParams();

    useEffect(() => {
        const fetchJobAndStatus = async () => {
            if (!jobId || !user) return;

            try {
                setJob(await api.getDoc('jobs', jobId));
                if (user.role === 'student') {
                    const mine = await api.list('applications', { jobId });
                    if (mine.length > 0) setIsApplied(true);
                }
            } catch (error) {
                console.error("Error fetching job status: ", error);
            } finally {
                setLoading(false);
            }
        };

        fetchJobAndStatus();
    }, [jobId, user]);

    useEffect(() => {
        if (jobId) api.get(`/api/ml/similar-jobs/${jobId}`).then(setSimilar).catch(() => setSimilar([]));
    }, [jobId]);

    const handleApply = async () => {
        // Updated to check for jobTitle instead of title
        if (!job || !job.jobTitle || !job.companyName) {
            console.error("Cannot apply, job data is incomplete:", job);
            return;
        }

        setIsApplying(true);
        try {
            await api.create('applications', { jobId, coverLetter: coverLetter.trim() });
            setIsApplied(true);
        } catch (error) {
            console.error("Error submitting application: ", error);
        } finally {
            setIsApplying(false);
        }
    };


    if (loading) {
        return <div className="text-center p-10">Loading Job Details...</div>;
    }

    if (!job) {
        return <div className="text-center p-10">Job not found.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto">
            <Link to="/jobs" className="text-teal-600 hover:text-teal-800 mb-6 inline-block">&larr; Back to all jobs</Link>
            <div className="bg-white p-8 rounded-lg shadow-lg">
                <div className="flex justify-between items-start">
                    <div>
                        {/* Use jobTitle to display the title */}
                        <h1 className="text-3xl font-bold text-gray-800">{job.jobTitle}</h1>
                        <p className="text-lg text-gray-600 mt-1">{job.companyName}</p>
                        <p className="text-md text-gray-500 mt-1">{job.location}</p>
                    </div>
                    <span className="bg-teal-100 text-teal-800 text-sm font-semibold px-3 py-1 rounded-full">{job.jobType}</span>
                </div>
                <hr className="my-6" />
                <div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Skills Required</h2>
                    <div className="flex flex-wrap gap-2">
                        {job.skills.map((skill, index) => (
                            <span key={index} className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-sm">{skill}</span>
                        ))}
                    </div>
                </div>
                {job.family && <p className="mt-4 text-sm text-gray-500">Job family: <span className="font-semibold text-indigo-700">{job.family}</span></p>}
                <div className="mt-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">Job Description</h2>
                    <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
                </div>
                {user.role === 'student' && <CoverLetterPanel jobId={jobId} value={coverLetter} onChange={setCoverLetter} disabled={isApplied} />}
                {user.role === 'student' && <div className="mt-8 text-center">
                    <button
                        onClick={handleApply}
                        disabled={isApplied || isApplying}
                        className={`font-bold py-3 px-8 rounded-lg transition duration-300 w-full md:w-auto ${
                            isApplied
                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                : 'bg-teal-600 text-white hover:bg-teal-700'
                        }`}
                    >
                        {isApplying ? 'Submitting...' : isApplied ? 'Applied' : 'Apply Now'}
                    </button>
                </div>}
            </div>
            {similar.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-3">Similar jobs</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        {similar.map(j => (
                            <Link key={j.id} to={`/jobs/${j.id}`} className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition border-l-4 border-indigo-400">
                                <div className="flex justify-between gap-2"><h3 className="font-bold text-gray-900">{j.jobTitle}</h3><span className="text-xs font-bold px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 whitespace-nowrap">{j.similarity}% similar</span></div>
                                <p className="text-sm text-gray-600">{j.companyName} · {j.location}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* */