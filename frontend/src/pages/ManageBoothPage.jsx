import React, { useState, useEffect, forwardRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// --- Icons ---
const ClockIcon = () => (<svg className="h-5 w-5 mr-2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const TrashIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>);
const CalendarIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>);

// --- Custom Styled Date Picker ---
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
const StyledDatePicker = ({ selected, onChange, placeholder }) => (
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


const ManageBoothPage = () => {
    const { boothId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [boothDetails, setBoothDetails] = useState(null);
    const [newSlot, setNewSlot] = useState(null); // Changed for DatePicker
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchBoothDetails = async () => {
            try {
                const boothData = await api.getDoc('booths', boothId);
                if (user && user.uid === boothData.companyId) {
                    setBoothDetails(boothData);
                } else {
                    toast.error("You are not authorized to manage this booth.");
                    navigate('/');
                }
            } catch (err) { setError(err.status === 404 ? "Booth not found." : "Failed to load booth details."); console.error(err); }
            setLoading(false);
        };
        if (user) { fetchBoothDetails(); }
    }, [boothId, user, navigate]);

    const handleAddSlot = async (e) => {
        e.preventDefault();
        if (!newSlot) { toast.error("Please select a time slot."); return; }
        const toastId = toast.loading('Adding slot...');
        try {
            setBoothDetails(await api.update('booths', boothId, {}, { addToSet: { availableSlots: newSlot } }));
            setNewSlot(null);
            toast.success("Slot added successfully!", { id: toastId });
        } catch (err) {
            toast.error("Failed to add slot.", { id: toastId });
            console.error(err);
        }
    };

    const handleDeleteSlot = (slotToDelete) => {
        Swal.fire({
            title: 'Delete this slot?', text: `${slotToDelete.toLocaleString()}`, icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const toastId = toast.loading('Deleting slot...');
                try {
                    setBoothDetails(await api.update('booths', boothId, {}, { pull: { availableSlots: slotToDelete } }));
                    toast.success("Slot deleted successfully!", { id: toastId });
                } catch (err) {
                    toast.error("Failed to delete slot.", { id: toastId });
                    console.error(err);
                }
            }
        });
    };

    if (loading) return <div className="text-center p-10">Loading Booth Manager...</div>;
    if (error) return <div className="text-center p-10 text-red-500 font-bold">{error}</div>;

    return (
        <div className="bg-slate-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black text-slate-800">Manage Your Booth</h1>
                    <p className="mt-2 text-xl font-semibold text-teal-600">{boothDetails?.companyName}</p>
                </div>

                <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900">Add New Interview Slot</h3>
                    <form onSubmit={handleAddSlot} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-2">
                            <label htmlFor="new-slot" className="block text-sm font-medium text-gray-700 mb-1">
                                Select Date and Time
                            </label>
                            <StyledDatePicker
                                selected={newSlot}
                                onChange={(date) => setNewSlot(date)}
                                placeholder="Click to select a date and time"
                            />
                        </div>
                        <button type="submit" className="w-full bg-teal-600 text-white py-3 px-4 rounded-lg hover:bg-teal-700 font-semibold shadow transition-colors">
                            Add Slot
                        </button>
                    </form>
                </div>

                <div className="mt-10 bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900">Your Available Slots</h3>
                    <div className="mt-4">
                        <ul className="space-y-3">
                            {boothDetails?.availableSlots && boothDetails.availableSlots.length > 0 ? (
                                boothDetails.availableSlots
                                    .map(slot => slot.toDate())
                                    .sort((a, b) => a - b)
                                    .map((slot, index) => (
                                        <li key={index} className="flex items-center justify-between p-4 bg-slate-100 rounded-lg">
                                            <div className="flex items-center font-medium text-gray-700">
                                                <ClockIcon />
                                                <span>{slot.toLocaleString()}</span>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteSlot(slot)}
                                                className="p-2 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </li>
                                    ))
                            ) : (
                                <p className="text-center text-gray-500 py-6">You have not added any slots yet.</p>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default ManageBoothPage;