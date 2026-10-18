import React, { useState, forwardRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// NAYE DATE PICKER KE IMPORTS
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// TOAST NOTIFICATION KA IMPORT
import toast from 'react-hot-toast';

// --- Icon Components for Form ---
const TitleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 D 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>);
const DescriptionIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>);
const CalendarIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>);
const ArrowRightIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>);

// --- Custom Date Picker Component ---
const CustomDateInput = forwardRef(({ value, onClick, placeholder }, ref) => (
  <div className="relative cursor-pointer" onClick={onClick} ref={ref}>
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><CalendarIcon /></div>
    <input
      type="text"
      className="block w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      value={value || ''}
      placeholder={placeholder}
      readOnly
    />
  </div>
));

const StyledDatePicker = ({ selected, onChange, placeholder }) => {
    return (
        <DatePicker
            selected={selected}
            onChange={onChange}
            showTimeSelect
            minDate={new Date()}
            dateFormat="MMMM d, yyyy h:mm aa"
            placeholderText={placeholder}
            customInput={<CustomDateInput placeholder={placeholder} />}
            required
            calendarClassName="border-2 border-indigo-200 rounded-lg shadow-lg bg-white font-sans"
            headerClassName="bg-indigo-600 text-white font-bold p-2 rounded-t-lg flex justify-between items-center"
            monthClassName="text-white"
            dayClassName={(date) => "m-1 h-8 w-8 flex items-center justify-center rounded-full hover:bg-indigo-100 transition-colors cursor-pointer"}
            timeClassName={(time) => "px-4 py-2 rounded-md hover:bg-indigo-100 transition-colors cursor-pointer"}
            timeContainerClassName="border-l border-gray-200"
            popperPlacement="bottom-end"
        />
    );
};


const CreateJobFairPage = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) { setError('You must be logged in to create a job fair.'); return; }
        if (!title || !startDate || !endDate) { return setError('Please fill in all required fields.'); }
        setLoading(true);
        setError('');
        try {
            await api.create('jobFairs', { title, description, startDate, endDate });
            
            // === ALERT KI JAGAH AB TOAST NOTIFICATION ===
            toast.success('Virtual Job Fair successfully created!');
            
            navigate('/job-fairs');
        } catch (err) {
            setError(err.message || 'Failed to create job fair.');
            toast.error('Failed to create job fair.');
            console.error("Create job fair error:", err);
        }
        setLoading(false);
    };

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl w-full">
                <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-2xl border-t-4 border-indigo-500">
                    <div className="text-center">
                        <h2 className="text-3xl font-black text-gray-900 sm:text-4xl tracking-tight">
                            Create a New Virtual Job Fair
                        </h2>
                        <p className="mt-3 text-sm text-gray-600">
                            Fill in the details to schedule a new event for students and companies.
                        </p>
                    </div>
                    <form className="mt-10 space-y-8" onSubmit={handleSubmit}>
                        {error && ( <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p>{error}</p></div> )}
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Job Fair Title</label>
                                <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><TitleIcon /></div><input id="title" type="text" required className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="e.g., Annual Tech Career Fair 2025" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                            </div>
                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <div className="relative"><div className="absolute top-3.5 left-0 pl-3 flex items-center pointer-events-none"><DescriptionIcon /></div><textarea id="description" rows="4" className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Briefly describe the event..." value={description} onChange={(e) => setDescription(e.target.value)}></textarea></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
                                    <StyledDatePicker 
                                        selected={startDate}
                                        onChange={(date) => setStartDate(date)}
                                        placeholder="Select start date"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
                                     <StyledDatePicker 
                                        selected={endDate}
                                        onChange={(date) => setEndDate(date)}
                                        placeholder="Select end date"
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <button type="submit" disabled={loading} className="group w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-300 ease-in-out transform hover:scale-105">
                                <span className="flex items-center">
                                    {loading ? 'Creating Event...' : 'Create Job Fair'}
                                    {!loading && <ArrowRightIcon />}
                                </span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateJobFairPage;