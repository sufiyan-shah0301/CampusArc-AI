import React, { useState, forwardRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// Date picker ke imports
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// --- Icons ---
const TitleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>);
const CalendarIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>);
const ArrowRightIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>);

// --- Custom Styled Date Picker Component ---
const CustomDateInput = forwardRef(({ value, onClick, placeholder }, ref) => (
  <div className="relative cursor-pointer" onClick={onClick} ref={ref}>
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><CalendarIcon /></div>
    <input
      type="text"
      className="block w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 sm:text-sm"
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
            calendarClassName="border-2 border-teal-200 rounded-lg shadow-lg bg-white font-sans"
            headerClassName="bg-teal-600 text-white font-bold p-2 rounded-t-lg flex justify-between items-center"
            dayClassName={() => "m-1 h-8 w-8 flex items-center justify-center rounded-full hover:bg-teal-100 transition-colors cursor-pointer"}
            timeClassName={() => "px-4 py-2 rounded-md hover:bg-teal-100 transition-colors cursor-pointer"}
            timeContainerClassName="border-l border-gray-200"
            popperPlacement="bottom-end"
        />
    );
};


const CreateQnaPage = () => {
    const [topic, setTopic] = useState('');
    const [scheduledTime, setScheduledTime] = useState(null); // Changed for DatePicker
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleScheduleSession = async (e) => {
        e.preventDefault();
        if (!topic || !scheduledTime) {
            return toast.error('Please fill out all fields.');
        }
        setLoading(true);
        try {
            await api.create('qna_sessions', { topic, scheduledTime });
            toast.success('Q&A session scheduled successfully!');
            navigate('/job-fairs'); // Redirect to events hub
        } catch (error) {
            console.error("Error scheduling session: ", error);
            toast.error('Failed to schedule session.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen flex items-center justify-center py-12 px-4">
            <div className="max-w-xl w-full bg-white p-8 sm:p-12 rounded-2xl shadow-2xl border-t-4 border-teal-500">
                <div className="text-center">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Schedule a Live Q&A</h1>
                    <p className="mt-3 text-lg text-slate-500">Host a live session to connect with potential candidates.</p>
                </div>

                <div className="mt-10">
                    <form onSubmit={handleScheduleSession} className="space-y-6">
                        <div>
                            <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-1">
                                Session Topic
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><TitleIcon /></div>
                                <input
                                    type="text"
                                    id="topic"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g., All About our Data Science Role"
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 sm:text-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="scheduledTime" className="block text-sm font-medium text-gray-700 mb-1">
                                Date and Time
                            </label>
                            <StyledDatePicker
                                selected={scheduledTime}
                                onChange={(date) => setScheduledTime(date)}
                                placeholder="Select a date and time"
                            />
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="group w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-gradient-to-r from-teal-600 to-green-500 hover:from-teal-700 hover:to-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-300 ease-in-out transform hover:scale-105"
                            >
                                <span className="flex items-center">
                                    {loading ? 'Scheduling...' : 'Schedule Session'}
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

export default CreateQnaPage;