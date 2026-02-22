import { useState, useEffect } from 'react';
import {
    LayoutDashboard, Users, ArrowRightLeft, CreditCard,
    FileText, ShieldAlert, LogOut, Bell, Menu, Plus, Search, Filter, Briefcase, X
} from 'lucide-react';
import { supabase } from './src/lib/supabase';
import './dashboard.css';

interface SaccoAdminProps { onLogout: () => void; }

interface Member {
    id: string; name: string; phone: string; email: string; nin: string; status: 'Active' | 'Inactive'; dateJoined: string; profile_id?: string;
}
interface Transaction {
    id: string; memberName: string; member_id: string; type: 'deposit' | 'withdrawal'; amount: number; date: string; note: string;
}
interface Loan {
    id: string; memberName: string; member_id: string; amount: number; purpose: string; status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed'; date: string; repaymentDate: string;
}
interface AuditLog {
    id: string; action: string; details: string; date: string; user: string;
}

const EMPTY_MEMBER: Omit<Member, 'id' | 'profile_id'> = { name: '', phone: '', email: '', nin: '', status: 'Active', dateJoined: '' };
const EMPTY_TXN: { memberId: string; type: Transaction['type']; amount: string; note: string } = { memberId: '', type: 'deposit', amount: '', note: '' };

export default function SaccoAdminDashboard({ onLogout }: SaccoAdminProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const saccoName = 'Your SACCO';

    // Data state
    const [members, setMembers] = useState<Member[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [auditLogs] = useState<AuditLog[]>([]);

    // Modal state
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberForm, setMemberForm] = useState({ ...EMPTY_MEMBER });
    const [editMemberId, setEditMemberId] = useState<string | null>(null);

    const [showAddTxn, setShowAddTxn] = useState(false);
    const [txnForm, setTxnForm] = useState({ ...EMPTY_TXN });

    const [showNotif, setShowNotif] = useState(false);
    const [notifTitle, setNotifTitle] = useState('');
    const [notifBody, setNotifBody] = useState('');
    const [notifSent, setNotifSent] = useState(false);

    // Filter state
    const [memberSearch, setMemberSearch] = useState('');
    const [txnDateFrom, setTxnDateFrom] = useState('');
    const [txnDateTo, setTxnDateTo] = useState('');
    const [auditAction, setAuditAction] = useState('');
    const [auditDateFrom, setAuditDateFrom] = useState('');
    const [auditDateTo, setAuditDateTo] = useState('');
    const [reportType, setReportType] = useState('members');
    const [reportDateFrom, setReportDateFrom] = useState('');
    const [reportDateTo, setReportDateTo] = useState('');

    const [currentSaccoId, setCurrentSaccoId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profile } = await supabase.from('profiles').select('sacco_id').eq('id', session.user.id).single();
        if (profile?.sacco_id) {
            setCurrentSaccoId(profile.sacco_id);

            const { data: membersData } = await supabase.from('members').select('*');
            if (membersData) {
                setMembers(membersData.map(m => ({ ...m, dateJoined: m.date_joined })));
            }

            const { data: txnsData } = await supabase.from('transactions').select('*');
            if (txnsData) {
                setTransactions(txnsData.map(t => ({
                    ...t,
                    memberName: membersData?.find(m => m.id === t.member_id)?.name || 'Unknown',
                })));
            }

            const { data: loansData } = await supabase.from('loans').select('*');
            if (loansData) {
                setLoans(loansData.map(l => ({
                    ...l,
                    memberName: membersData?.find(m => m.id === l.member_id)?.name || 'Unknown',
                    repaymentDate: l.repayment_date
                })));
            }
        }
    };

    // ─── Member handlers ───────────────────────────────────────
    function openAddMember() { setMemberForm({ ...EMPTY_MEMBER }); setEditMemberId(null); setShowAddMember(true); }
    function openEditMember(m: Member) { setMemberForm({ name: m.name, phone: m.phone, email: m.email, nin: m.nin, status: m.status, dateJoined: m.dateJoined }); setEditMemberId(m.id); setShowAddMember(true); }

    async function saveMember() {
        if (!memberForm.name || !currentSaccoId) return;

        if (editMemberId !== null) {
            await supabase.from('members').update({
                name: memberForm.name,
                phone: memberForm.phone,
                email: memberForm.email,
                nin: memberForm.nin,
                status: memberForm.status
            }).eq('id', editMemberId);
        } else {
            // Usually requires Service Role key, provided per prompt request
            const { data: authData, error: authError } = await (supabase.auth.admin as any)?.createUser?.({
                email: memberForm.email,
                email_confirm: true,
                user_metadata: { role: 'member', full_name: memberForm.name, sacco_id: currentSaccoId }
            });

            if (authError || !authData?.user) {
                alert("Could not implicitly create auth user via admin. Ensure service role key is bound or manually create them: " + (authError?.message || ""));
                return;
            }

            await supabase.from('members').insert([{
                sacco_id: currentSaccoId,
                profile_id: authData.user.id,
                name: memberForm.name,
                phone: memberForm.phone,
                email: memberForm.email,
                nin: memberForm.nin,
                status: memberForm.status,
                date_joined: memberForm.dateJoined || new Date().toISOString().split('T')[0]
            }]);
        }

        await fetchData();
        setShowAddMember(false);
    }

    async function deleteMember(id: string) {
        if (!confirm('Delete member?')) return;
        await supabase.from('members').delete().eq('id', id);
        await fetchData();
    }

    // ─── Transaction handlers ──────────────────────────────────
    async function saveTxn() {
        if (!txnForm.memberId || !txnForm.amount || !currentSaccoId) return;

        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from('transactions').insert([{
            sacco_id: currentSaccoId,
            member_id: txnForm.memberId,
            type: txnForm.type,
            amount: Number(txnForm.amount),
            note: txnForm.note,
            created_by: session?.user.id
        }]);

        await fetchData();
        setTxnForm({ ...EMPTY_TXN });
        setShowAddTxn(false);
    }

    // ─── Loan handlers ─────────────────────────────────────────
    async function updateLoanStatus(id: string, status: Loan['status']) {
        await supabase.from('loans').update({ status }).eq('id', id);
        await fetchData();
    }

    // ─── Notification handler ──────────────────────────────────
    async function sendNotif() {
        if (!notifTitle || !notifBody || !currentSaccoId) return;

        const { data: { session } } = await supabase.auth.getSession();

        await supabase.from('notifications').insert([{
            sacco_id: currentSaccoId,
            title: notifTitle,
            message: notifBody,
            created_by: session?.user.id
        }]);

        setNotifSent(true);
        setTimeout(() => { setNotifSent(false); setNotifTitle(''); setNotifBody(''); setShowNotif(false); }, 2000);
    }

    // ─── Filters ────────────────────────────────────────────────
    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.phone.includes(memberSearch) ||
        m.email.toLowerCase().includes(memberSearch.toLowerCase())
    );

    const filteredTxns = transactions.filter(t => {
        if (txnDateFrom && t.date < txnDateFrom) return false;
        if (txnDateTo && t.date > txnDateTo) return false;
        return true;
    });

    const filteredAudit = auditLogs.filter(a => {
        if (auditAction && !a.action.toLowerCase().includes(auditAction.toLowerCase())) return false;
        if (auditDateFrom && a.date < auditDateFrom) return false;
        if (auditDateTo && a.date > auditDateTo) return false;
        return true;
    });

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { id: 'members', label: 'Members', icon: <Users size={20} /> },
        { id: 'transactions', label: 'Transactions', icon: <ArrowRightLeft size={20} /> },
        { id: 'loans', label: 'Loans', icon: <CreditCard size={20} /> },
        { id: 'reports', label: 'Reports', icon: <FileText size={20} /> },
        { id: 'audit', label: 'Audit Logs', icon: <ShieldAlert size={20} /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <>
                        <div className="dash-metrics-grid">
                            <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('members')}>
                                <div className="metric-label">Total Members <Users size={20} color="#718096" /></div>
                                <div className="metric-value">{members.length}</div>
                                <span className="action-link" style={{ fontSize: '0.85rem', marginTop: '12px', display: 'inline-block' }}>View Members →</span>
                            </div>
                            <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('transactions')}>
                                <div className="metric-label">Total Savings <ArrowRightLeft size={20} color="#718096" /></div>
                                <div className="metric-value">UGX {transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0).toLocaleString()}</div>
                                <span className="action-link" style={{ fontSize: '0.85rem', marginTop: '12px', display: 'inline-block' }}>View Transactions →</span>
                            </div>
                            <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('loans')}>
                                <div className="metric-label">Active Loans <Briefcase size={20} color="#718096" /></div>
                                <div className="metric-value">{loans.filter(l => l.status === 'approved' || l.status === 'active').length}</div>
                                <span className="action-link" style={{ fontSize: '0.85rem', marginTop: '12px', display: 'inline-block' }}>View Loans →</span>
                            </div>
                        </div>
                        <div className="dash-section-header"><h2>Quick Actions</h2></div>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <button className="btn-dark" onClick={() => { setActiveTab('members'); openAddMember(); }}><Plus size={18} /> Add New Member</button>
                            <button className="btn-dark" onClick={() => { setActiveTab('transactions'); setShowAddTxn(true); }}><Plus size={18} /> Record Transaction</button>
                            <button className="btn-dark" onClick={() => setActiveTab('loans')}><FileText size={18} /> Review Loan Apps</button>
                        </div>
                    </>
                );

            case 'members':
                return (
                    <>
                        <div className="dash-section-header">
                            <h2>Members Directory</h2>
                            <button className="btn-dark" onClick={openAddMember}><Plus size={18} /> Add Member</button>
                        </div>
                        <div className="filters-row">
                            <div className="search-bar">
                                <Search size={18} color="#a0aec0" />
                                <input type="text" placeholder="Search by name, phone, email…" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                            </div>
                        </div>
                        <div className="dash-table-wrapper">
                            {filteredMembers.length === 0 ? (
                                <div className="dash-empty-state"><Users size={48} strokeWidth={1.5} /><p>No members found.</p></div>
                            ) : (
                                <table className="dash-table">
                                    <thead><tr><th>Name</th><th>NIN</th><th>Phone</th><th>Email</th><th>Status</th><th>Date Joined</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {filteredMembers.map(m => (
                                            <tr key={m.id}>
                                                <td>{m.name}</td>
                                                <td>{m.nin || '—'}</td>
                                                <td>{m.phone}</td>
                                                <td>{m.email}</td>
                                                <td><span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', background: m.status === 'Active' ? '#e6f4ea' : '#fce8e8', color: m.status === 'Active' ? '#2d7a47' : '#c53030' }}>{m.status}</span></td>
                                                <td>{m.dateJoined}</td>
                                                <td style={{ display: 'flex', gap: '8px' }}>
                                                    <button className="action-link" onClick={() => openEditMember(m)}>Edit</button>
                                                    <button style={{ color: '#e53e3e', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }} onClick={() => deleteMember(m.id)}>Remove</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                );

            case 'transactions':
                return (
                    <>
                        <div className="dash-section-header">
                            <h2>Transactions</h2>
                            <button className="btn-dark" onClick={() => setShowAddTxn(true)}><Plus size={18} /> Add Transaction</button>
                        </div>
                        <div className="filters-row" style={{ flexWrap: 'wrap' }}>
                            <Filter size={18} color="#718096" />
                            <span style={{ fontWeight: 600, color: '#4a5568', fontSize: '0.9rem' }}>Filter by Date:</span>
                            <input type="date" className="input-field" style={{ width: 'auto' }} value={txnDateFrom} onChange={e => setTxnDateFrom(e.target.value)} />
                            <span style={{ color: '#718096' }}>to</span>
                            <input type="date" className="input-field" style={{ width: 'auto' }} value={txnDateTo} onChange={e => setTxnDateTo(e.target.value)} />
                            {(txnDateFrom || txnDateTo) && <button className="action-link" onClick={() => { setTxnDateFrom(''); setTxnDateTo(''); }}>Clear</button>}
                        </div>
                        <div className="dash-table-wrapper">
                            {filteredTxns.length === 0 ? (
                                <div className="dash-empty-state"><ArrowRightLeft size={48} strokeWidth={1.5} /><p>No transactions match the filter.</p></div>
                            ) : (
                                <table className="dash-table">
                                    <thead><tr><th>Member</th><th>Type</th><th>Amount (UGX)</th><th>Date</th><th>Note</th></tr></thead>
                                    <tbody>
                                        {filteredTxns.map(t => (
                                            <tr key={t.id}>
                                                <td>{t.memberName}</td>
                                                <td><span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', background: t.type === 'deposit' ? '#e6f4ea' : '#fce8e8', color: t.type === 'deposit' ? '#2d7a47' : '#c53030', textTransform: 'capitalize' }}>{t.type}</span></td>
                                                <td>{Number(t.amount).toLocaleString()}</td>
                                                <td>{t.date}</td>
                                                <td>{t.note || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                );

            case 'loans':
                return (
                    <>
                        <div className="dash-section-header"><h2>Loan Applications</h2></div>
                        <div className="dash-table-wrapper">
                            {loans.length === 0 ? (
                                <div className="dash-empty-state"><Briefcase size={48} strokeWidth={1.5} /><p>No loan applications yet.</p></div>
                            ) : (
                                <table className="dash-table">
                                    <thead><tr><th>Member</th><th>Amount (UGX)</th><th>Purpose</th><th>Applied On</th><th>Deadline</th><th>Status</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {loans.map(l => (
                                            <tr key={l.id}>
                                                <td>{l.memberName}</td>
                                                <td>{Number(l.amount).toLocaleString()}</td>
                                                <td>{l.purpose}</td>
                                                <td>{l.date}</td>
                                                <td>{l.repaymentDate}</td>
                                                <td><span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', background: l.status === 'approved' ? '#e6f4ea' : l.status === 'rejected' ? '#fce8e8' : '#fef9e7', color: l.status === 'approved' ? '#2d7a47' : l.status === 'rejected' ? '#c53030' : '#92610a', textTransform: 'capitalize' }}>{l.status}</span></td>
                                                <td style={{ display: 'flex', gap: '8px' }}>
                                                    {l.status === 'pending' && (<>
                                                        <button className="action-link" onClick={() => updateLoanStatus(l.id, 'approved')}>Approve</button>
                                                        <button style={{ color: '#e53e3e', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }} onClick={() => updateLoanStatus(l.id, 'rejected')}>Reject</button>
                                                    </>)}
                                                    {l.status !== 'pending' && <span style={{ color: '#718096', fontSize: '0.85rem' }}>Reviewed</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                );

            case 'reports':
                return (
                    <>
                        <div className="dash-section-header"><h2>Export Reports</h2></div>
                        <div style={{ background: '#fff', border: '1px solid #e3e8ee', borderRadius: '12px', padding: '24px', maxWidth: '560px' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <label className="label-field">Report Type</label>
                                <select className="input-field" value={reportType} onChange={e => setReportType(e.target.value)}>
                                    <option value="members">Members</option>
                                    <option value="transactions">Transactions</option>
                                    <option value="loans">Loans</option>
                                </select>
                            </div>
                            <div className="form-grid" style={{ marginBottom: '24px' }}>
                                <div>
                                    <label className="label-field">From</label>
                                    <input type="date" className="input-field" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)} />
                                </div>
                                <div>
                                    <label className="label-field">To</label>
                                    <input type="date" className="input-field" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)} />
                                </div>
                            </div>
                            <button className="btn-dark" onClick={() => alert(`Exporting ${reportType} report${reportDateFrom ? ` from ${reportDateFrom}` : ''}${reportDateTo ? ` to ${reportDateTo}` : ''}…`)}><FileText size={18} /> Export {reportType.charAt(0).toUpperCase() + reportType.slice(1)} (CSV)</button>
                        </div>
                    </>
                );

            case 'audit':
                return (
                    <>
                        <div className="dash-section-header"><h2>Audit Logs</h2></div>
                        <div className="filters-row" style={{ flexWrap: 'wrap', gap: '12px' }}>
                            <Filter size={18} color="#718096" />
                            <select className="input-field" style={{ width: '180px' }} value={auditAction} onChange={e => setAuditAction(e.target.value)}>
                                <option value="">All Actions</option>
                                <option value="Login">Login</option>
                                <option value="Logout">Logout</option>
                                <option value="Member Created">Member Created</option>
                                <option value="Member Updated">Member Updated</option>
                                <option value="Member Deleted">Member Deleted</option>
                                <option value="Transaction Recorded">Transaction Recorded</option>
                                <option value="Loan Approved">Loan Approved</option>
                                <option value="Loan Rejected">Loan Rejected</option>
                                <option value="Notification Sent">Notification Sent</option>
                            </select>
                            <input type="date" className="input-field" style={{ width: 'auto' }} value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)} />
                            <span style={{ color: '#718096' }}>to</span>
                            <input type="date" className="input-field" style={{ width: 'auto' }} value={auditDateTo} onChange={e => setAuditDateTo(e.target.value)} />
                            {(auditAction || auditDateFrom || auditDateTo) && <button className="action-link" onClick={() => { setAuditAction(''); setAuditDateFrom(''); setAuditDateTo(''); }}>Clear</button>}
                        </div>
                        <div className="dash-table-wrapper">
                            {filteredAudit.length === 0 ? (
                                <div className="dash-empty-state"><ShieldAlert size={48} strokeWidth={1.5} /><p>No audit logs match the filter.</p></div>
                            ) : (
                                <table className="dash-table">
                                    <thead><tr><th>Action</th><th>User</th><th>Date</th><th>Details</th></tr></thead>
                                    <tbody>{filteredAudit.map(a => (<tr key={a.id}><td>{a.action}</td><td>{a.user}</td><td>{a.date}</td><td>{a.details}</td></tr>))}</tbody>
                                </table>
                            )}
                        </div>
                    </>
                );

            default: return null;
        }
    };

    return (
        <div className="dash-layout">
            {sidebarOpen && <div className="sidebar-overlay active" onClick={() => setSidebarOpen(false)} />}
            <div className={`dash-sidebar ${!sidebarOpen ? 'dash-sidebar-closed' : ''}`}>
                <div className="dash-logo-box">
                    <span className="dash-logo-text">SaccoFlow</span>
                    <button className="btn-icon" onClick={() => setSidebarOpen(false)}><Menu size={18} /></button>
                </div>
                <div className="nav-menu">
                    {navItems.map(item => (
                        <div key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => { setActiveTab(item.id); if (window.innerWidth < 768) setSidebarOpen(false); }}>
                            {item.icon} {item.label}
                        </div>
                    ))}
                </div>
                <div style={{ padding: '16px', borderTop: '1px solid #e3e8ee' }}>
                    <button className="nav-item nav-logout" style={{ width: '100%' }} onClick={onLogout}><LogOut size={20} /> Logout</button>
                </div>
            </div>

            <div className="dash-main">
                <div className="dash-header-bar">
                    <div className="dash-header-left">
                        {!sidebarOpen && <button className="btn-icon" style={{ flexShrink: 0 }} onClick={() => setSidebarOpen(true)}><Menu size={18} /></button>}
                    </div>
                    <div className="dash-header-center">
                        <span className="dash-header-title">{saccoName}</span>
                    </div>
                    <div className="dash-header-actions">
                        <button className="btn-icon" title="Send Notification" onClick={() => setShowNotif(true)}><Bell size={18} /></button>
                    </div>
                </div>
                <div className="dash-content">{renderContent()}</div>
            </div>

            {/* Add Member Modal */}
            {showAddMember && (
                <div className="modal-backdrop" onClick={() => setShowAddMember(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editMemberId !== null ? 'Edit Member' : 'Add New Member'}</h3>
                            <button className="btn-icon" onClick={() => setShowAddMember(false)}><X size={18} /></button>
                        </div>
                        <div className="form-grid" style={{ gap: '16px' }}>
                            <div><label className="label-field">Full Name *</label><input className="input-field" placeholder="Jane Doe" value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} /></div>
                            <div><label className="label-field">Phone</label><input className="input-field" placeholder="+256…" value={memberForm.phone} onChange={e => setMemberForm(f => ({ ...f, phone: e.target.value }))} /></div>
                            <div><label className="label-field">Email</label><input type="email" className="input-field" placeholder="jane@example.com" value={memberForm.email} onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} /></div>
                            <div><label className="label-field">NIN</label><input className="input-field" placeholder="CM12345678…" value={memberForm.nin} onChange={e => setMemberForm(f => ({ ...f, nin: e.target.value }))} /></div>
                            <div>
                                <label className="label-field">Status</label>
                                <select className="input-field" value={memberForm.status} onChange={e => setMemberForm(f => ({ ...f, status: e.target.value as 'Active' | 'Inactive' }))}>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="label-field">Date Joined *</label>
                                <input type="date" className="input-field" value={memberForm.dateJoined} onChange={e => setMemberForm(f => ({ ...f, dateJoined: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-outline-cancel" onClick={() => setShowAddMember(false)}>Cancel</button>
                            <button className="btn-dark" onClick={saveMember}>{editMemberId !== null ? 'Save Changes' : 'Add Member'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Transaction Modal */}
            {showAddTxn && (
                <div className="modal-backdrop" onClick={() => setShowAddTxn(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add Transaction</h3>
                            <button className="btn-icon" onClick={() => setShowAddTxn(false)}><X size={18} /></button>
                        </div>
                        <div className="form-grid" style={{ gap: '16px' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="label-field">Member *</label>
                                <select className="input-field" value={txnForm.memberId} onChange={e => setTxnForm(f => ({ ...f, memberId: e.target.value }))}>
                                    <option value="">Select member…</option>
                                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                                {members.length === 0 && <p style={{ color: '#718096', fontSize: '0.8rem', marginTop: '6px' }}>Add a member first before recording a transaction.</p>}
                            </div>
                            <div>
                                <label className="label-field">Transaction Type</label>
                                <select className="input-field" value={txnForm.type} onChange={e => setTxnForm(f => ({ ...f, type: e.target.value as Transaction['type'] }))}>
                                    <option value="deposit">Deposit</option>
                                    <option value="withdrawal">Withdrawal</option>
                                </select>
                            </div>
                            <div>
                                <label className="label-field">Amount (UGX) *</label>
                                <input type="number" className="input-field" placeholder="0" value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="label-field">Note</label>
                                <input className="input-field" placeholder="Optional note…" value={txnForm.note} onChange={e => setTxnForm(f => ({ ...f, note: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-outline-cancel" onClick={() => setShowAddTxn(false)}>Cancel</button>
                            <button className="btn-dark" onClick={saveTxn}>Save Transaction</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Send Notification Modal */}
            {showNotif && (
                <div className="modal-backdrop" onClick={() => setShowNotif(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Send Notification to All Members</h3>
                            <button className="btn-icon" onClick={() => setShowNotif(false)}><X size={18} /></button>
                        </div>
                        {notifSent ? (
                            <div style={{ textAlign: 'center', padding: '32px 0', color: '#2d7a47' }}>
                                <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>✓ Notification sent to all members!</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div><label className="label-field">Title *</label><input className="input-field" placeholder="e.g. Upcoming AGM" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} /></div>
                                    <div><label className="label-field">Message *</label><textarea className="input-field" rows={4} placeholder="Type your message here…" value={notifBody} onChange={e => setNotifBody(e.target.value)} style={{ resize: 'vertical' }} /></div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn-outline-cancel" onClick={() => setShowNotif(false)}>Cancel</button>
                                    <button className="btn-dark" onClick={sendNotif}><Bell size={16} /> Send to All Members</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
