import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast'; // Naya import
import Swal from 'sweetalert2';   // Naya import

const BookingModal = ({ booth, onClose, onBookingSuccess }) => {
    const { user } = useAuth();
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSlots = async () => {
            try {
                const boothData = await api.getDoc('booths', booth.id);
                setSlots(boothData.availableSlots.map(slot => slot.toDate()).sort((a, b) => a - b));
            } catch (error) {
                console.error("Error fetching slots:", error);
            }
            setLoading(false);
        };
        fetchSlots();
    }, [booth.id]);

    // === BOOKING FUNCTION KO NAYE POPUPS KE SAATH UPDATE KIYA GAYA HAI ===
    const handleBookSlot = (slotToBook) => {
        Swal.fire({
            title: 'Confirm Booking',
            html: `Are you sure you want to book a slot with <strong>${booth.companyName}</strong> for <br/><strong>${slotToBook.toLocaleString()}</strong>?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#2dd4bf', // Teal color
            cancelButtonColor: '#f87171', // Red color
            confirmButtonText: 'Yes, book it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const toastId = toast.loading('Booking your slot...');
                try {
                    // the server books the slot atomically, so two students can never get the same one
                    await api.post('/api/appointments/book', { boothId: booth.id, slot: slotToBook });

                    toast.success("Your slot has been successfully booked!", { id: toastId });
                    onBookingSuccess(); // Parent component ko batana ki booking ho gayi
                    onClose(); // Modal band karna
                } catch (error) {
                    toast.error("Failed to book slot. It might have been taken.", { id: toastId });
                    console.error("Error booking slot:", error);
                }
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 max-w-lg w-full transform transition-all animate-fade-in-up">
                <h2 className="text-2xl font-bold mb-2 text-slate-800">Book a Slot with {booth.companyName}</h2>
                <p className="mb-6 text-slate-500">Select an available time slot below for a short chat or interview.</p>
                
                {loading ? <p>Loading slots...</p> : (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {slots.length > 0 ? slots.map((slot, index) => (
                            // === HAR SLOT KE LIYE NAYA DESIGN ===
                            <div
                                key={index}
                                className="flex items-center justify-between bg-slate-100 p-3 rounded-lg"
                            >
                                <span className="font-semibold text-slate-700">{slot.toLocaleString()}</span>
                                <button 
                                    onClick={() => handleBookSlot(slot)}
                                    className="bg-teal-500 text-white font-bold py-2 px-4 rounded-md hover:bg-teal-600 transition-colors text-sm shadow-sm"
                                >
                                    Book Now
                                </button>
                            </div>
                        )) : <p className="text-center text-slate-500 py-8">No available slots at the moment.</p>}
                    </div>
                )}
                
                <button
                    onClick={onClose}
                    className="mt-6 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default BookingModal;