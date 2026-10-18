import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

const UserCircleIcon = () => (
    <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

const CompanyProfilePage = () => {
    const { companyId } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!companyId) {
                setLoading(false);
                return;
            }
            try {
                setProfile(await api.getDoc('users', companyId));
            } catch (error) {
                console.error("Error fetching company profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [companyId]);

    if (loading) {
        return <div className="text-center p-10">Loading Company Profile...</div>;
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
                        <img className="w-32 h-32 rounded-full object-cover border-4 border-blue-500" src={profile.photoURL} alt="Company Logo" />
                    ) : (
                        <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100">
                           <UserCircleIcon />
                        </div>
                    )}
                    <div className="text-center md:text-left mt-4 md:mt-0">
                        <h1 className="text-3xl font-bold text-gray-900">{profile.profile?.companyName || profile.displayName}</h1>
                        <p className="text-md text-gray-600 font-semibold">{profile.profile?.industry}</p>
                        {profile.profile?.companyWebsite && (
                             <a href={profile.profile.companyWebsite} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline mt-1 inline-block">Visit Website</a>
                        )}
                    </div>
                </div>

                <div className="mt-8 border-t pt-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">About Company</h2>
                    <p className="text-gray-600 whitespace-pre-wrap">{profile.profile?.aboutCompany || 'No description provided.'}</p>
                </div>
            </div>
        </div>
    );
};

export default CompanyProfilePage;