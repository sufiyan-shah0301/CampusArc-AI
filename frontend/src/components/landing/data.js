// All landing-page copy lives here. Every number in MODELS is measured on held-out data (see the admin "ML Models" page).

export const NAV_LINKS = [
    { label: 'Features', href: '#features' },
    { label: 'AI & ML', href: '#ai' },
    { label: 'Security', href: '#security' },
    { label: 'How it works', href: '#how' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
];

export const STATS = [
    { value: 10, suffix: '+', label: 'Trained ML models' },
    { value: 0.97, decimals: 2, label: 'Fake-job detector AUC' },
    { value: 11, label: 'AI tools for students' },
    { value: 3, label: 'Roles: student, recruiter, admin' },
];

export const TECH = ['React', 'FastAPI', 'MongoDB', 'scikit-learn', 'CLIP', 'Whisper', 'Sentence-Transformers', 'Playwright', 'WebSockets', 'JWT + TOTP'];

export const ROLES = [
    {
        icon: '🎓', title: 'Students', tone: 'from-brand-500 to-emerald-500',
        points: ['AI resume scanner with ATS score and fixes', 'Voice mock interviews that adapt to you', 'Placement chance, salary range and skill gap', 'One-click apply with AI cover letters'],
        cta: 'Join as a student', to: '/register',
    },
    {
        icon: '🏢', title: 'Recruiters', tone: 'from-indigo-500 to-violet-500',
        points: ['Post jobs screened by a fraud model', 'AI-ranked candidates for every opening', 'Applicant pipeline, chat and CSV export', 'Virtual job fairs with bookable slots'],
        cta: 'Hire talent', to: '/register',
    },
    {
        icon: '🛡️', title: 'Placement cell', tone: 'from-amber-500 to-orange-500',
        points: ['Live placement analytics and reports', 'Review flagged jobs and duplicate resumes', 'Manage courses, resources and companies', 'Model metrics, shown honestly'],
        cta: 'Admin login', to: '/login',
    },
];

export const FEATURES = [
    { icon: '🧾', title: 'AI Resume Scanner', desc: 'Upload a PDF and get an ATS score, extracted skills, section scores, a job match and a prioritised fix list.', tag: 'AI', chip: 'LLM + ML', color: 'brand' },
    { icon: '🎤', title: 'Voice Mock Interviews', desc: 'Answer out loud. Difficulty adapts to your score, and you get feedback on pace, filler words and pauses.', tag: 'AI', chip: 'Whisper', color: 'indigo' },
    { icon: '📈', title: 'Placement & Salary Predictor', desc: 'See your placement chance and likely salary range, and try "what if I add an internship?" before you do.', tag: 'ML', chip: 'AUC 0.88', color: 'emerald' },
    { icon: '🚨', title: 'Fake-Job Shield', desc: 'Every posting is screened by a Random Forest and an Isolation Forest. Risky ones wait for admin review.', tag: 'ML', chip: 'AUC 0.97', color: 'rose' },
    { icon: '🎯', title: 'Semantic Job Matching', desc: 'Embeddings understand meaning, not just keywords, so "ReactJS" and "frontend developer" match.', tag: 'ML', chip: 'Embeddings', color: 'violet' },
    { icon: '🧭', title: 'Skill-gap & Courses', desc: 'Compare your skills with what open jobs ask for and get the courses that close the gap.', tag: 'Smart', chip: 'Live data', color: 'amber' },
    { icon: '🎪', title: 'Job Fairs & Live Q&A', desc: 'Join virtual fairs, book interview slots without double-booking, and ask recruiters live.', tag: 'Events', chip: 'Real-time', color: 'sky' },
    { icon: '💬', title: 'Chat & Notifications', desc: 'Message recruiters in real time and get alerts for every status change, in-app or by e-mail.', tag: 'Live', chip: 'WebSocket', color: 'teal' },
    { icon: '🕵️', title: 'Verify Media & Links', desc: 'Check photos and videos for deepfakes, and open unknown links in a throw-away browser.', tag: 'Safety', chip: 'CLIP + Chromium', color: 'fuchsia' },
    { icon: '✍️', title: 'Resume Builder', desc: 'Build a clean resume with live preview, AI rewriting of weak bullets and one-click PDF download.', tag: 'Tool', chip: 'PDF', color: 'orange' },
    { icon: '📊', title: 'Analytics & Reports', desc: 'Pipeline funnels, hiring stats and CSV exports for recruiters and the placement cell.', tag: 'Insights', chip: 'CSV', color: 'cyan' },
    { icon: '🔐', title: 'Privacy by design', desc: 'Two-factor login, data export and erase, and media that is deleted right after analysis.', tag: 'Trust', chip: 'GDPR / CCPA', color: 'slate' },
];

export const MODELS = [
    { name: 'Fake-job detector', algo: 'Random Forest', metric: '0.974', unit: 'ROC-AUC', data: '17,880 postings', tone: 'text-rose-600 dark:text-rose-300' },
    { name: 'Phishing URL model', algo: 'Random Forest + n-gram LogReg', metric: '0.991', unit: 'ROC-AUC', data: '507k URLs', tone: 'text-amber-600 dark:text-amber-300' },
    { name: 'Resume classifier', algo: 'LogReg + Random Forest', metric: '85%', unit: 'accuracy, 24 classes', data: '2,483 resumes', tone: 'text-brand-600 dark:text-brand-300' },
    { name: 'Placement predictor', algo: 'Gradient Boosting', metric: '0.88', unit: 'ROC-AUC', data: '1,137 students', tone: 'text-emerald-600 dark:text-emerald-300' },
    { name: 'Deepfake detector', algo: 'CLIP + MLP + forensics', metric: '0.885', unit: 'ROC-AUC', data: '12k faces, 2k unseen test', tone: 'text-indigo-600 dark:text-indigo-300' },
    { name: 'Job families', algo: 'K-Means clustering', metric: '14', unit: 'clusters found', data: '16k real postings', tone: 'text-violet-600 dark:text-violet-300' },
];

export const STEPS = [
    { n: '01', icon: '📝', title: 'Create your profile', desc: 'Sign up as a student or recruiter. Add skills and academic details; recruiters add their company.' },
    { n: '02', icon: '🧠', title: 'Scan, practise, improve', desc: 'Scan your resume, take voice mock interviews and follow your personal skill-gap plan.' },
    { n: '03', icon: '🎯', title: 'Get matched', desc: 'Semantic matching recommends jobs to students and ranks candidates for recruiters.' },
    { n: '04', icon: '🤝', title: 'Interview and get hired', desc: 'Book slots at job fairs, chat in real time, track every status and celebrate the offer.' },
];

export const SECURITY = [
    { icon: '🔑', title: 'Two-factor login', desc: 'TOTP codes with recovery codes, replay protection and lock-out.' },
    { icon: '🧪', title: 'Disposable browser', desc: 'Suspicious links open in an isolated Chromium behind an SSRF guard. Your device is never exposed.' },
    { icon: '🛂', title: 'Server-side access rules', desc: 'Roles are enforced by the API on every request, not just hidden in the interface.' },
    { icon: '🧹', title: 'Data clearance', desc: 'Uploaded media is analysed in memory and deleted. Saved summaries expire after 24 hours.' },
    { icon: '📦', title: 'Your data, your call', desc: 'Download everything we hold or delete your account any time (GDPR / CCPA).' },
    { icon: '🚦', title: 'Rate limits everywhere', desc: 'Login, AI and media endpoints are throttled to stop abuse and password guessing.' },
];

export const FAQ = [
    { q: 'Who is CampusArc for?', a: 'Students preparing for placements, recruiters who want vetted candidates, and placement-cell admins who need one place to run it all.' },
    { q: 'Is my resume stored?', a: 'The file is analysed and not kept. We save only the results (scores, skills, suggestions) in your account so you can compare scans. You can delete everything from Security & Privacy.' },
    { q: 'How accurate are the AI predictions?', a: 'We publish the real numbers (see the AI & ML section). They are screening signals, not guarantees: the placement and salary tools show ranges, and the deepfake detector is about 80% accurate on unseen faces.' },
    { q: 'Can I trust the jobs listed?', a: 'Every posting is checked by a fraud model. High-risk postings stay hidden from students until an admin approves them.' },
    { q: 'Does it work on my phone?', a: 'Yes. The whole platform is built mobile-first, including voice answers, resume upload and the live camera check.' },
    { q: 'How do I become an admin?', a: 'Admin accounts cannot be self-registered. The platform owner creates them from the server, which keeps the placement cell secure.' },
];
