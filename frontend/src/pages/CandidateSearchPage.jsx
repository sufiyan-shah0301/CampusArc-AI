import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

// --- Icons ---
const SearchIcon = () => (<svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const ChatIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>);

// --- Student Avatar ---
const StudentAvatar = ({ name, photoURL }) => {
    if (photoURL) {
        return <img src={photoURL} alt={name} className="flex-shrink-0 h-16 w-16 rounded-full object-cover" />;
    }
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return (
        <div className="flex-shrink-0 h-16 w-16 flex items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-green-600 text-white text-3xl font-bold">
            {initial}
        </div>
    );
};

export default function CandidateSearchPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [skillTerm, setSkillTerm] = useState('');
    const [locationTerm, setLocationTerm] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [allStudents, setAllStudents] = useState([]);

    // Fetch all students only once on component mount
    useEffect(() => {
        const fetchAllStudents = async () => {
            setLoading(true);
            try {
                setAllStudents(await api.list('users', { role: 'student' }));
            } catch (error) {
                console.error("Error fetching students:", error);
                toast.error("Could not load student data.");
            }
            setLoading(false);
        };
        fetchAllStudents();
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        if (!skillTerm.trim() && !locationTerm.trim()) {
            return toast.error("Please enter a skill or location to search.");
        }
        setSearched(true);
        const lowercasedSkill = skillTerm.toLowerCase();
        const lowercasedLocation = locationTerm.toLowerCase();

        const filteredStudents = allStudents.filter(student => {
            const hasSkill = lowercasedSkill 
                ? student.profile?.skills?.some(skill => skill.toLowerCase().includes(lowercasedSkill)) 
                : true;
            const hasLocation = lowercasedLocation 
                ? student.profile?.location?.toLowerCase().includes(lowercasedLocation)
                : true;
            return hasSkill && hasLocation;
        });

        setResults(filteredStudents);
        if (filteredStudents.length === 0) {
            toast("No students found matching your criteria.", { icon: '🤷‍♂️' });
        }
    };

    const handleStartChat = async (student) => {
        if (!user) return toast.error("Please log in to start a chat.");
        const toastId = toast.loading("Starting chat...");
        try {
            const chat = await api.startChat(student.id);
            toast.success("Chat ready!", { id: toastId });
            navigate(`/chat/${chat.id}`);
        } catch (error) {
            toast.error("Could not start chat.", { id: toastId });
            console.error(error);
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="w-full max-w-5xl mx-auto py-12 px-4">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black text-slate-800">Candidate Search</h1>
                    <p className="mt-3 text-lg text-slate-500">Find the perfect candidates by filtering by skills and location.</p>
                </div>
                <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 p-6 bg-white rounded-xl shadow-lg border">
                    <div className="relative md:col-span-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon/></div>
                        <input
                            type="text" value={skillTerm} onChange={(e) => setSkillTerm(e.target.value)}
                            placeholder="Search by skill (e.g., React)"
                            className="w-full pl-10 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <div className="relative md:col-span-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon/></div>
                        <input
                            type="text" value={locationTerm} onChange={(e) => setLocationTerm(e.target.value)}
                            placeholder="Search by location (e.g., Mumbai)"
                            className="w-full pl-10 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <button type="submit" disabled={loading} className="md:col-span-1 bg-teal-600 text-white font-bold py-3 px-6 rounded-md hover:bg-teal-700 disabled:bg-gray-400">
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </form>
                
                <div className="space-y-6">
                    {searched && !loading && results.length === 0 && (
                        <div className="text-center text-gray-500 bg-white p-12 rounded-xl shadow-md">
                            <h3 className="text-xl font-semibold">No Candidates Found</h3>
                            <p>Try broadening your search criteria.</p>
                        </div>
                    )}
                    {results.map(student => (
                        <div key={student.id} className="bg-white p-6 rounded-xl shadow-md border border-transparent hover:border-teal-400 transition-all flex flex-col sm:flex-row items-center gap-6">
                            <StudentAvatar name={student.displayName} photoURL={student.profile?.profileImgUrl}/>
                            <div className="flex-grow text-center sm:text-left">
                                <Link to={`/student/${student.id}`} className="text-xl font-bold text-gray-800 hover:text-teal-600">{student.displayName}</Link>
                                <p className="text-gray-600">{student.profile?.headline}</p>
                                <p className="text-sm text-gray-500 mt-1">{student.profile?.location}</p>
                                {student.profile?.skills && (
                                <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                                    {student.profile.skills.slice(0, 4).map((skill) => (
                                        <span key={skill} className="bg-gray-200 text-gray-800 px-2 py-1 rounded-full text-xs font-semibold">{skill}</span>
                                    ))}
                                </div>
                                )}
                            </div>
                            <div className="flex-shrink-0 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                <Link to={`/student/${student.id}`} className="w-full sm:w-auto text-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">View Profile</Link>
                                <button onClick={() => handleStartChat(student)} className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700">
                                    <ChatIcon /> <span className="ml-2">Chat</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}