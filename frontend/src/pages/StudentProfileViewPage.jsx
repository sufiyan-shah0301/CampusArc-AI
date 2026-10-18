import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

// Placeholder for a generic avatar icon
const UserCircleIcon = () => (
    <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

// <-- CHANGE: Naya Icon Add Kiya -->
const EmailIcon = () => (
    <svg className="w-4 h-4 mr-1.5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
);

const StudentProfileViewPage = () => {
    const { studentId } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setProfile(await api.getDoc('users', studentId));
            } catch (error) {
                console.error("Error fetching profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [studentId]);

    if (loading) {
        return <div className="text-center p-10">Loading Profile...</div>;
    }

    if (!profile) {
        return (
            <div className="text-center p-10">
                <h2 className="text-2xl font-bold">Profile not found.</h2>
                <Link to="/dashboard" className="mt-4 inline-block text-teal-600 hover:underline">Return to Dashboard</Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <div className="bg-white shadow-xl rounded-lg p-8">
                <div className="flex flex-col items-center md:flex-row md:items-start md:space-x-8">
                    {profile.photoURL ? (
                        <img className="w-32 h-32 rounded-full object-cover border-4 border-teal-500" src={profile.photoURL} alt="Profile" />
                    ) : (
                        <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100">
                           <UserCircleIcon />
                        </div>
                    )}
                    <div className="text-center md:text-left mt-4 md:mt-0">
                        <h1 className="text-3xl font-bold text-gray-900">{profile.displayName}</h1>
                        <p className="text-md text-teal-600 font-semibold">{profile.profile?.headline}</p>
                        
                        {/* <-- CHANGE: Email aur LinkedIn ko yahan display kiya hai --> */}
                        <div className="flex items-center justify-center md:justify-start space-x-4 mt-2">
                            {profile.email && (
                                <div className="flex items-center text-sm text-gray-500">
                                    <EmailIcon />
                                    <span>{profile.email}</span>
                                </div>
                            )}
                            {profile.profile?.linkedinUrl && (
                                 <a href={profile.profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">LinkedIn Profile</a>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 border-t pt-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">About Me</h2>
                    <p className="text-gray-600 whitespace-pre-wrap">{profile.profile?.bio || 'No bio provided.'}</p>
                </div>

                <div className="mt-8 border-t pt-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Skills</h2>
                    <div className="flex flex-wrap gap-2">
                        {profile.profile?.skills?.length > 0 ? (
                            profile.profile.skills.map((skill, index) => (
                                <span key={index} className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm font-medium">
                                    {skill}
                                </span>
                            ))
                        ) : (
                            <p className="text-gray-500">No skills listed.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentProfileViewPage;