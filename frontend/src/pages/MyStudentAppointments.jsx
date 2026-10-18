import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { downloadIcs } from '../lib/ics';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// --- Icon & Avatar Components ---
const CalendarIcon = () => ( <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg> );
const ChatIcon = () => ( <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm14 1a1 1 0 00-1-1H5a1 1 0 00-1 1v5l4-2 4 2 4-2V6z" /></svg> );
const ProfileIcon = () => ( <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg> );
const CompanyAvatar = ({ name }) => { const initial = name ? name.charAt(0).toUpperCase() : '?'; return ( <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl font-bold"> {initial} </div> ); };

const MyStudentAppointments = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const fetchAppointments = async () => {
            try {
                setAppointments(await api.list('appointments', { sort: 'scheduledTime' }));
            } catch (err) { console.error("Error fetching student appointments:", err); }
            setLoading(false);
        };
        fetchAppointments();
    }, [user]);

    const handleStartChat = async (otherId) => {
        if (!user || !otherId) return toast.error("Contact details are missing.");
        const toastId = toast.loading("Starting chat...");
        try {
            const chat = await api.startChat(otherId);
            toast.success("Chat ready!", { id: toastId });
            navigate(`/chat/${chat.id}`);
        } catch (error) {
            toast.error("Could not start chat.", { id: toastId });
            console.error("Error starting chat:", error);
        }
    };

    if (loading) { return <div className="text-center p-10">Loading your scheduled interviews...</div>; }

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight">My Scheduled Interviews</h1>
                    <p className="mt-3 max-w-2xl mx-auto text-lg text-slate-500">Your upcoming interview schedule with various companies.</p>
                </div>
                
                {appointments.length > 0 ? (
                    <div className="bg-white shadow-xl rounded-xl border border-gray-200">
                        <ul className="divide-y divide-gray-200">
                            {appointments.map(app => (
                                <li key={app.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                                    <div className="flex items-center">
                                        <CompanyAvatar name={app.companyName} />
                                        <div className="ml-4">
                                            <p className="text-lg font-bold text-slate-900">Interview with {app.companyName}</p>
                                            <div className="flex items-center text-sm text-slate-500 mt-1">
                                                <CalendarIcon />
                                                <span>{new Date(app.scheduledTime.seconds * 1000).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center space-x-3">
                                        <span className="px-3 py-1 text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">{app.status}</span>
                                        
                                        <button onClick={() => downloadIcs({ title: `Interview with ${app.companyName}`, start: app.scheduledTime, durationMin: 30, uid: app.id, description: 'Booked through CampusArc job fair' })} className="flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">📅 Add to calendar</button>
                                        {/* <-- YEH BUTTON UPDATE HUA HAI --> */}
                                        <Link to={`/company/${app.companyId}`} className="flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                            <ProfileIcon /> Company Profile
                                        </Link>
                                        
                                        <button 
                                            onClick={() => handleStartChat(app.companyId)}
                                            className="flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                        >
                                            <ChatIcon /> Chat with Recruiter
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="text-center bg-white p-12 rounded-xl shadow-xl border border-gray-200">
                        <h3 className="mt-4 text-xl font-semibold text-slate-800">No Scheduled Interviews</h3>
                        <p className="mt-2 text-slate-500">You haven't booked any interview slots yet. Explore virtual job fairs to find opportunities!</p>
                        <Link to="/job-fairs" className="mt-6 inline-block bg-blue-600 text-white py-2 px-5 rounded-lg font-semibold hover:bg-blue-700">Find Job Fairs</Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyStudentAppointments;