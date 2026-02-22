import { useState, useEffect } from 'react';
import { Building2, Users, Plus, LogOut, Shield, Menu, X, Mail, Globe } from 'lucide-react';
import { supabase } from './src/lib/supabase';
import './dashboard.css';

interface AdminDashboardProps {
    onLogout: () => void;
}

interface Sacco {
    id: string;
    name: string;
    email: string;
    location: string;
    nin: string;
    status: 'active' | 'suspended';
    usersCount: number;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [saccos, setSaccos] = useState<Sacco[]>([]);

    const [showAddModal, setShowAddModal] = useState(false);
    const [newSacco, setNewSacco] = useState({
        name: '',
        email: '',
        location: '',
        nin: '',
        status: 'active' as const
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchSaccos();
    }, []);

    const fetchSaccos = async () => {
        const { data: saccoData, error: saccoError } = await supabase.from('saccos').select('*').order('created_at', { ascending: false });
        if (saccoError) return console.error(saccoError);

        const { data: profileData, error: profileError } = await supabase.from('profiles').select('sacco_id');
        if (profileError) return console.error(profileError);

        const mappedSaccos: Sacco[] = saccoData.map((s: any) => ({
            ...s,
            status: s.status === 'active' ? 'active' : 'suspended',
            usersCount: profileData ? profileData.filter(p => p.sacco_id === s.id).length : 0
        }));

        setSaccos(mappedSaccos);
    };

    const handleAddSacco = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSacco.name || !newSacco.email) return;
        setLoading(true);

        const { data, error } = await supabase
            .from('saccos')
            .insert([{
                name: newSacco.name,
                email: newSacco.email,
                location: newSacco.location,
                nin: newSacco.nin,
                status: newSacco.status
            }])
            .select()
            .single();

        if (error) {
            alert(error.message);
            setLoading(false);
            return;
        }

        // Ideally here you invite the admin using a backend endpoint that calls auth.admin.createUser
        // Since we are frontend only, we just register the organization.

        setSaccos([{ ...data, usersCount: 0, status: data.status as 'active' | 'suspended' }, ...saccos]);
        setNewSacco({ name: '', email: '', location: '', nin: '', status: 'active' });
        setShowAddModal(false);
        setLoading(false);
    };

    const deleteSacco = async (id: string) => {
        if (!confirm('Are you sure you want to delete this SACCO?')) return;
        const { error } = await supabase.from('saccos').delete().eq('id', id);
        if (!error) setSaccos(saccos.filter(s => s.id !== id));
    };

    const toggleStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const { error } = await supabase.from('saccos').update({ status: newStatus }).eq('id', id);
        if (!error) {
            setSaccos(saccos.map(s =>
                s.id === id ? { ...s, status: newStatus as 'active' | 'suspended' } : s
            ));
        }
    };

    const totalLiveUsers = saccos.reduce((acc, s) => acc + s.usersCount, 0);

    return (
        <div className="dash-layout">
            {sidebarOpen && <div className="sidebar-overlay active" onClick={() => setSidebarOpen(false)} />}
            <div className={`dash-sidebar ${!sidebarOpen ? 'dash-sidebar-closed' : ''}`}>
                <div className="dash-logo-box">
                    <span className="dash-logo-text">SaccoFlow Admin</span>
                    <button className="btn-icon" onClick={() => setSidebarOpen(false)}><Menu size={18} /></button>
                </div>
                <div className="nav-menu">
                    <div className="nav-item active"><Shield size={20} /> Platform Overview</div>
                </div>
                <div style={{ padding: '16px', borderTop: '1px solid #e3e8ee' }}>
                    <button className="nav-item nav-logout" style={{ width: '100%', border: 'none', background: 'none' }} onClick={onLogout}>
                        <LogOut size={20} /> Logout
                    </button>
                </div>
            </div>

            <div className="dash-main">
                <div className="dash-header-bar">
                    <div className="dash-header-left">
                        {!sidebarOpen && <button className="btn-icon" onClick={() => setSidebarOpen(true)}><Menu size={18} /></button>}
                    </div>
                    <div className="dash-header-center">
                        <h2 className="dash-header-title">SaccoFlow</h2>
                    </div>
                </div>
                <div className="dash-content">
                    <div className="dash-metrics-grid">
                        <div className="metric-card">
                            <div className="metric-label">Registered SACCOs <Building2 size={20} color="#718096" /></div>
                            <div className="metric-value">{saccos.length}</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-label">Live Platform Users <Users size={20} color="#718096" /></div>
                            <div className="metric-value">{totalLiveUsers.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="dash-section-header">
                        <h2>Sacco Organizations</h2>
                        <button className="btn-dark" onClick={() => setShowAddModal(true)}><Plus size={18} /> Add SACCO</button>
                    </div>

                    <div className="dash-table-wrapper">
                        {saccos.length === 0 ? (
                            <div className="dash-empty-state">
                                <Building2 size={48} strokeWidth={1.5} />
                                <p>No SACCOs registered on the platform yet.</p>
                            </div>
                        ) : (
                            <table className="dash-table">
                                <thead>
                                    <tr>
                                        <th>Organization</th>
                                        <th>Registration/NIN</th>
                                        <th>Location</th>
                                        <th>Admin Email</th>
                                        <th>Users</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {saccos.map(s => (
                                        <tr key={s.id}>
                                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                                            <td>{s.nin || '—'}</td>
                                            <td>{s.location || '—'}</td>
                                            <td>{s.email}</td>
                                            <td>{s.usersCount}</td>
                                            <td>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '999px',
                                                    fontSize: '0.8rem',
                                                    background: s.status === 'active' ? '#e6f4ea' : '#fce8e8',
                                                    color: s.status === 'active' ? '#2d7a47' : '#c53030',
                                                    fontWeight: 600,
                                                    textTransform: 'capitalize'
                                                }}>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <button className="action-link" onClick={() => toggleStatus(s.id, s.status)}>
                                                        {s.status === 'active' ? 'Suspend' : 'Activate'}
                                                    </button>
                                                    <button className="action-link" style={{ color: '#e53e3e' }} onClick={() => deleteSacco(s.id)}>
                                                        Remove
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Add SACCO Modal */}
            {showAddModal && (
                <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Register New SACCO</h3>
                            <button className="btn-icon" onClick={() => setShowAddModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleAddSacco}>
                            <div className="form-grid" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label className="label-field">SACCO Name *</label>
                                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                        <Building2 size={18} style={{ position: 'absolute', left: '12px', color: '#a0aec0' }} />
                                        <input
                                            className="input-field"
                                            style={{ paddingLeft: '40px' }}
                                            placeholder="e.g. Skyline Savings Group"
                                            required
                                            value={newSacco.name}
                                            onChange={e => setNewSacco({ ...newSacco, name: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label className="label-field">Admin Email *</label>
                                        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                            <Mail size={18} style={{ position: 'absolute', left: '12px', color: '#a0aec0' }} />
                                            <input
                                                type="email"
                                                className="input-field"
                                                style={{ paddingLeft: '40px' }}
                                                placeholder="admin@sacco.com"
                                                required
                                                value={newSacco.email}
                                                onChange={e => setNewSacco({ ...newSacco, email: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label-field">Location</label>
                                        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                            <Globe size={18} style={{ position: 'absolute', left: '12px', color: '#a0aec0' }} />
                                            <input
                                                className="input-field"
                                                style={{ paddingLeft: '40px' }}
                                                placeholder="e.g. Kampala"
                                                value={newSacco.location}
                                                onChange={e => setNewSacco({ ...newSacco, location: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="label-field">National ID / NIN</label>
                                    <input
                                        className="input-field"
                                        placeholder="Enter NIN or Registration No."
                                        value={newSacco.nin}
                                        onChange={e => setNewSacco({ ...newSacco, nin: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-outline-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" className="btn-dark" disabled={loading}>{loading ? 'Registering...' : 'Register SACCO'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
