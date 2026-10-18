// Navigation per role. `tabs` are the 4 shortcuts shown in the phone's bottom bar (the 5th slot is "More").
const student = {
    tabs: [['/dashboard', 'Home', 'home'], ['/jobs', 'Jobs', 'briefcase'], ['/courses', 'Learn', 'book'], ['/insights', 'Insights', 'chart']],
    groups: [
        { label: 'Overview', items: [['/dashboard', 'Dashboard', 'home'], ['/jobs', 'Browse jobs', 'briefcase'], ['/my-applications', 'My applications', 'clipboard'], ['/job-fairs', 'Job fairs', 'store'], ['/my-scheduled-interviews', 'Interviews', 'calendar']] },
        { label: 'Learn', items: [['/courses', 'Courses', 'book'], ['/my-courses', 'My courses', 'check'], ['/resources', 'Resources', 'library'], ['/companies', 'Companies', 'building']] },
        { label: 'AI tools', items: [['/insights', 'Career insights', 'chart'], ['/resume-scanner', 'Resume scanner', 'file'], ['/mock-interview', 'Mock interview', 'mic'], ['/resume-builder', 'Resume builder', 'pencil'], ['/verify', 'Verify media & links', 'shield']] },
        { label: 'Connect', items: [['/chat', 'Messages', 'chat']] },
    ],
};

const recruiter = {
    tabs: [['/dashboard', 'Home', 'home'], ['/manage-jobs', 'Jobs', 'briefcase'], ['/candidate-search', 'Candidates', 'search'], ['/chat', 'Messages', 'chat']],
    groups: [
        { label: 'Hiring', items: [['/dashboard', 'Dashboard', 'home'], ['/post-job', 'Post a job', 'plus'], ['/manage-jobs', 'Manage jobs', 'briefcase'], ['/candidate-search', 'Search candidates', 'search']] },
        { label: 'Events', items: [['/job-fairs', 'Job fairs', 'store'], ['/create-job-fair', 'Create job fair', 'calendar'], ['/my-appointments', 'Appointments', 'clock'], ['/create-qna', 'Schedule Q&A', 'mic']] },
        { label: 'Tools', items: [['/verify', 'Verify media & links', 'shield'], ['/chat', 'Messages', 'chat']] },
    ],
};

const admin = {
    tabs: [['/admin', 'Home', 'home'], ['/admin/users', 'Users', 'users'], ['/admin/jobs', 'Jobs', 'briefcase'], ['/admin/ml', 'ML', 'cpu']],
    groups: [
        { label: 'Admin', items: [['/admin', 'Overview', 'home'], ['/admin/users', 'Users', 'users'], ['/admin/jobs', 'Jobs', 'briefcase'], ['/admin/integrity', 'Integrity', 'flag'], ['/admin/ml', 'ML models', 'cpu']] },
        { label: 'Content', items: [['/admin/courses', 'Courses', 'book'], ['/admin/resources', 'Resources', 'library'], ['/admin/companies', 'Companies', 'building']] },
    ],
};

export const NAV = { student, recruiter, admin };
export const ACCOUNT = [['/profile', 'Profile', 'user'], ['/security', 'Security', 'lock']];

/** Title for the top bar: the most specific nav entry whose path prefixes the current URL. */
export function titleFor(role, pathname) {
    const nav = NAV[role];
    if (!nav) return '';
    const all = [...nav.groups.flatMap((g) => g.items), ...ACCOUNT];
    const hit = all.filter(([to]) => pathname === to || pathname.startsWith(`${to}/`)).sort((a, b) => b[0].length - a[0].length)[0];
    return hit ? hit[1] : '';
}
