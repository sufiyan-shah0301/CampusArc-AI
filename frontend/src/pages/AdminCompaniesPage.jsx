// src/pages/AdminCompaniesPage.jsx
import React, { useState, useEffect } from 'react';
import { Avatar } from '../components/dashboard/parts.jsx';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from 'react-hot-toast';

export default function AdminCompaniesPage() {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCompanies = async () => {
        setCompanies(await api.list('companies'));
        setLoading(false);
    };

    useEffect(() => {
        fetchCompanies();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this company profile?")) {
            await api.remove('companies', id);
            toast.success("Company profile deleted!");
            fetchCompanies();
        }
    };

    if (loading) return <div className="text-center p-10">Loading Companies...</div>;

    return (
        <div className="container mx-auto p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Manage Company Profiles</h1>
                <Link to="/admin/companies/new" className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded">
                    + Add New Company
                </Link>
            </div>
            <div className="bg-white shadow-md rounded-lg">
                <ul className="divide-y divide-gray-200">
                    {companies.map(company => (
                        <li key={company.id} className="p-4 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <Avatar name={company.companyName} src={company.logoUrl} className="h-12 w-12 text-base" />
                                <div>
                                    <p className="font-semibold">{company.companyName}</p>
                                    <p className="text-sm text-gray-500">{company.industry}</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <Link to={`/admin/companies/edit/${company.id}`} className="text-blue-600 font-semibold">Edit</Link>
                                <button onClick={() => handleDelete(company.id)} className="text-red-600 font-semibold">Delete</button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}