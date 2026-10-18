import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import useLive from '../hooks/useLive';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const statusColors = {
    'Under Review': 'bg-yellow-100 text-yellow-800',
    'Interviewing': 'bg-blue-100 text-blue-800',
    'Hired': 'bg-green-100 text-green-800',
    'Rejected': 'bg-red-100 text-red-800',
};

const StudentAvatar = ({ name }) => {
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return <div className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-500 text-white font-bold">{initial}</div>;
};

const ApplicantsPage = () => {
    const { jobId } = useParams();
    const [applicants, setApplicants] = useState([]);
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ranked, setRanked] = useState(null);
    const [ranking, setRanking] = useState(false);
    const navigate = useNavigate();

    const rankCandidates = async () => {
        setRanking(true);
        try {
            setRanked((await api.get(`/api/ml/candidates/${jobId}`)).candidates);
        } catch (error) {
            toast.error(error.message || 'Could not rank candidates.');
        } finally {
            setRanking(false);
        }
    };

    const startChat = async (studentId) => {
        try {
            const chat = await api.startChat(studentId);
            navigate(`/chat/${chat.id}`);
        } catch (error) {
            toast.error('Could not start chat.');
        }
    };

    useEffect(() => {
        api.getDoc('jobs', jobId).then(setJob).catch(() => toast.error('Could not load the job.'));
    }, [jobId]);

    useLive(async () => {
        setApplicants(await api.list('applications', { jobId, sort: '-matchScore' }));
        setLoading(false);
    }, 'applications', [jobId]);

    const handleStatusChange = async (appId, newStatus) => {
        try {
            await api.update('applications', appId, { status: newStatus });
            toast.success("Status updated successfully!");
        } catch (error) {
            toast.error("Failed to update status.");
        }
    };

    if (loading) return <div className="text-center p-10">Loading Applicants...</div>;

    return (
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
                <Link to="/manage-jobs" className="text-sm font-medium text-gray-600 hover:text-gray-900">&larr; Back to your jobs</Link>
                <h1 className="text-3xl font-bold text-gray-900 mt-2">Applicants for {job?.jobTitle || '...'}</h1>
            </div>

            <div className="bg-white shadow-md rounded-lg p-6 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">AI candidate ranking</h2>
                        <p className="text-sm text-gray-500">Ranks all students for this job using sentence-embedding similarity (60%) and skill overlap (40%). Includes people who have not applied yet.</p>
                    </div>
                    <button onClick={rankCandidates} disabled={ranking} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-5 py-2 rounded-md disabled:bg-gray-400 whitespace-nowrap">
                        {ranking ? 'Ranking…' : ranked ? 'Refresh ranking' : 'Find top candidates'}
                    </button>
                </div>
                {ranked && (
                    <ul className="mt-5 divide-y">
                        {ranked.slice(0, 10).map((c, i) => (
                            <li key={c.id} className="py-4 flex flex-col md:flex-row md:items-center gap-3">
                                <div className="flex items-center gap-4 flex-1">
                                    <span className="w-8 text-center text-lg font-bold text-gray-400">{i + 1}</span>
                                    <div className="h-12 w-12 flex-shrink-0 rounded-full bg-gradient-to-br from-teal-500 to-green-600 text-white flex items-center justify-center font-bold">{(c.displayName || '?')[0].toUpperCase()}</div>
                                    <div>
                                        <Link to={`/student/${c.id}`} className="font-semibold text-gray-900 hover:text-teal-700">{c.displayName}</Link>
                                        {c.applied && <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Applied</span>}
                                        {c.hasResumeScan && <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Resume scanned</span>}
                                        <p className="text-sm text-gray-500">{[c.headline, c.location].filter(Boolean).join(' · ') || 'No profile details yet'}</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {c.matchedSkills.map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">{s}</span>)}
                                            {c.missingSkills.map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 line-through">{s}</span>)}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-center md:w-40">
                                    <p className="text-2xl font-extrabold text-teal-700">{c.fit}%</p>
                                    <p className="text-xs text-gray-500">fit · semantic {c.semantic}% · skills {c.skillOverlap}%</p>
                                </div>
                                <button onClick={() => startChat(c.id)} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-md">Chat</button>
                            </li>
                        ))}
                        {ranked.length === 0 && <li className="py-6 text-center text-gray-500">No students found yet.</li>}
                    </ul>
                )}
            </div>

            <div className="bg-white shadow-xl rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skill Match</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied On</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Change Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {applicants.length > 0 ? applicants.map(app => (
                                <tr key={app.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <StudentAvatar name={app.studentName} />
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{app.studentName}</div>
                                                <div className="text-sm text-gray-500">{app.studentEmail}</div>
                                                {app.coverLetter && <details className="mt-1 max-w-md"><summary className="cursor-pointer text-xs font-semibold text-teal-700">Cover letter</summary><p className="mt-1 text-xs text-gray-600 whitespace-pre-wrap">{app.coverLetter}</p></details>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${app.matchScore >= 70 ? 'bg-green-100 text-green-800' : app.matchScore >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}>
                                            {app.matchScore ?? 0}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {app.appliedAt.toDate().toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[app.status] || 'bg-gray-100 text-gray-800'}`}>
                                            {app.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                        <select
                                            onChange={(e) => handleStatusChange(app.id, e.target.value)}
                                            value={app.status}
                                            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        >
                                            <option>Under Review</option>
                                            <option>Interviewing</option>
                                            <option>Hired</option>
                                            <option>Rejected</option>
                                        </select>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="text-center text-gray-500 py-12">No applicants for this job yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ApplicantsPage;