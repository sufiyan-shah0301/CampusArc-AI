import React, { useState } from 'react';
import { api } from '../lib/api.js';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

// --- About Us Page ---
export function AboutUsPage() {
    return (
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-lg">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">About CampusArc</h1>
            <p className="text-gray-600 mb-6">
                CampusArc was founded on a simple mission: to seamlessly connect aspiring talent with the industry's leading opportunities. We believe that the gap between education and employment can be bridged with the right tools, training, and connections.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-3">Our Vision</h2>
            <p className="text-gray-600 mb-6">
                We envision a world where every student has the clarity and confidence to pursue their dream career, and every company has access to a pipeline of skilled, prepared, and motivated talent. Our platform is the engine that drives this vision forward.
            </p>

            <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-3">What We Do</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
                <li>Provide students with a curated list of job opportunities from top-tier companies.</li>
                <li>Offer a comprehensive library of courses to upskill and prepare for the modern workforce.</li>
                <li>Equip students with innovative tools like our AI Interview Coach to build confidence.</li>
                <li>Give recruiters a powerful platform to find and connect with the best emerging talent.</li>
            </ul>
        </div>
    );
}

// --- Contact Page --

export function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: '',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.message) {
            toast.error('Please fill out all fields.');
            return;
        }

        setLoading(true);
        const toastId = toast.loading('Sending your message...');

        try {
            await api.post('/api/contact', { name: formData.name, email: formData.email, message: formData.message });

            toast.success('Message sent successfully!', { id: toastId });
            // Reset the form fields after a successful submission
            setFormData({ name: '', email: '', message: '' });
        } catch (error) {
            console.error("Error submitting contact form:", error);
            toast.error('Could not send message. Please try again later.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-center items-center py-12">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white p-8 sm:p-10 rounded-xl shadow-lg w-full max-w-2xl"
            >
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">Contact Us</h1>
                <p className="text-gray-600 mb-8">We'd love to hear from you! Please fill out the form below.</p>

                <form onSubmit={handleSubmit} noValidate>
                    <div className="mb-6">
                        <label htmlFor="name" className="block text-gray-700 font-semibold mb-2">Full Name</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="John Doe"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition-shadow"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="email" className="block text-gray-700 font-semibold mb-2">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="you@example.com"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition-shadow"
                            required
                        />
                    </div>
                    <div className="mb-8">
                        <label htmlFor="message" className="block text-gray-700 font-semibold mb-2">Message</label>
                        <textarea
                            id="message"
                            name="message"
                            value={formData.message}
                            onChange={handleChange}
                            placeholder="Your message..."
                            rows="5"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition-shadow"
                            required
                        ></textarea>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-teal-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-teal-700 transition-all duration-300 disabled:bg-gray-400"
                    >
                        {loading ? 'Sending...' : 'Send Message'}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}



// --- Privacy Policy Page ---
export function PrivacyPolicyPage() {
    const H = ({ children }) => <h2 className="text-2xl font-semibold text-gray-800 mt-8 mb-3">{children}</h2>;
    const P = ({ children }) => <p className="text-gray-600 mb-4">{children}</p>;
    return (
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-lg">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Privacy Policy</h1>
            <p className="text-gray-500 mb-8">Last updated: October 2026. Written to meet the GDPR and the CCPA/CPRA.</p>
            <H>1. What we collect</H>
            <P>Account details (name, e-mail, role, password hash), the profile you fill in (headline, skills, academic details), your applications, course progress, resume scans and interview practice results, messages you send, and basic technical data needed to keep the service secure (rate-limit counters). We do not collect payment data.</P>
            <H>2. Why we use it (legal basis)</H>
            <P>To run the platform you signed up for (contract), to keep it secure and prevent fraud (legitimate interest), and to send optional e-mail notifications (consent, which you can withdraw in Security &amp; Privacy). AI and machine-learning features process your data on our servers; text you send to the AI assistant, resume scanner and interview tools is forwarded to our language-model provider only to produce the answer and is not used by us to train models.</P>
            <H>3. Media and links you verify</H>
            <P>Photos, videos and webcam frames you check are analysed in memory and deleted as soon as the result is ready. Links are opened in a disposable browser that is destroyed afterwards. If you ask us to keep a summary report, it contains scores only (never the file) and is deleted automatically after 24 hours.</P>
            <H>4. How long we keep data</H>
            <P>Account data until you delete your account; notifications for 90 days; saved verification summaries for 24 hours. Deleting your account removes your profile, applications, scans, interview history, messages and notifications.</P>
            <H>5. Your rights</H>
            <P>You can access and download your data, correct it in your profile, delete your account, withdraw e-mail consent and turn on two-factor authentication, all from <a href="/security" className="text-teal-700 underline">Security &amp; Privacy</a>. EU/UK residents may also lodge a complaint with their data-protection authority. California residents have the rights to know, delete and correct, and the right to opt out of the sale or sharing of personal information. <strong>We do not sell or share personal information for advertising.</strong> We will not discriminate against you for exercising these rights.</P>
            <H>6. Security</H>
            <P>Passwords are hashed with bcrypt, sessions use short-lived signed tokens, authenticator secrets are encrypted at rest, all access is checked on the server by role, and requests are rate-limited. No system is perfectly secure; if a breach affects you we will tell you without undue delay.</P>
            <H>7. Contact</H>
            <P>Questions or requests: use the <a href="/contact" className="text-teal-700 underline">contact form</a>.</P>
        </div>
    );
}
