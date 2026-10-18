import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import toast from 'react-hot-toast';

// Helper to get a color based on user role
const getRoleColor = (role) => {
    if (role === 'admin') return 'bg-red-100 text-red-800';
    if (role === 'recruiter') return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800'; // student
};

export default function AdminUsersPage() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Function to fetch all users
    const fetchUsers = async () => {
        if (!user) return;
        setLoading(true);
        try {
            setUsers(await api.list('users'));
        } catch (error) {
            console.error("Error fetching users: ", error);
            toast.error("Failed to load users.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [user]);

    // Memoized filtering of users based on search term
    const filteredUsers = useMemo(() => {
        return users.filter(u =>
            u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const handleRoleChange = async (userId, newRole) => {
        const toastId = toast.loading("Updating user role...");
        try {
            await api.update('users', userId, { role: newRole });
            toast.success("User role updated successfully!", { id: toastId });
            fetchUsers(); // Refresh the list
        } catch (error) {
            toast.error("Failed to update role.", { id: toastId });
            console.error("Error updating role:", error);
        }
    };

    const handleDeleteUser = async (userId, displayName) => {
        // A real app would use a confirmation modal here
        if (window.confirm(`Are you sure you want to delete the user "${displayName}"? This permanently deletes their account and related data.`)) {
            const toastId = toast.loading("Deleting user...");
            try {
                await api.remove('users', userId);
                toast.success("User deleted.", { id: toastId });
                fetchUsers();
            } catch (error) {
                toast.error(error.message || "Failed to delete user.", { id: toastId });
            }
        }
    };

    if (loading) {
        return <div className="text-center p-10">Loading users...</div>;
    }

    return (
        <div className="w-full">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Manage Users</h1>
            <div className="mb-6">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full max-w-lg p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                />
            </div>
            <div className="bg-white shadow-lg rounded-lg overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-gray-100">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                    {filteredUsers.map(u => (
                        <tr key={u.id}>
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{u.displayName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">{u.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleColor(u.role)}`}>
                                        {u.role}
                                    </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                {u.id !== user.uid && ( // Prevent admin from editing their own role
                                    <select
                                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                        defaultValue=""
                                        className="border border-gray-300 rounded-md p-1"
                                    >
                                        <option value="" disabled>Change Role</option>
                                        <option value="student">Student</option>
                                        <option value="recruiter">Recruiter</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                )}
                                {u.id !== user.uid && (
                                    <button onClick={() => handleDeleteUser(u.id, u.displayName)} className="text-red-600 hover:text-red-900">
                                        Delete
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
