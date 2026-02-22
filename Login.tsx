import { useState } from 'react';
import { supabase } from './src/lib/supabase';
import './index.css';

interface LoginProps {
    onBack: () => void;
    onLogin: (role: string) => void;
}

export default function Login({ onBack, onLogin }: LoginProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) throw signInError;

            // Wait a moment for the trigger to insert the profile if this is a first login 
            // after creating a user, though it should be fast.
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (profileError) {
                // Wait briefly and retry once if the trigger was slightly delayed
                await new Promise(r => setTimeout(r, 1000));
                const { data: retryData, error: retryError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();
                if (retryError) throw retryError;

                const role = retryData.role;
                if (role === 'saccoflow_admin') onLogin('superadmin');
                else if (role === 'sacco_admin') onLogin('saccoadmin');
                else onLogin('member');
                return;
            }

            const role = profileData.role;
            if (role === 'saccoflow_admin') {
                onLogin('superadmin');
            } else if (role === 'sacco_admin') {
                onLogin('saccoadmin');
            } else {
                onLogin('member');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-header">
                <button className="btn ghost" onClick={onBack}>
                    <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>←</span> Back
                </button>
                <div className="logo" style={{ color: '#fff' }}>SaccoFlow</div>
            </div>

            <div className="login-container">
                <div className="login-card reveal delay-1">
                    <h2>Welcome back</h2>
                    <p>Sign in to your SaccoFlow account</p>

                    {error && (
                        <div style={{ background: '#fce8e8', color: '#c53030', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="form-group">
                            <label htmlFor="email">Email address</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="branch@sacco.com"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label htmlFor="password">Password</label>
                                <a href="#" className="forgot-password">Forgot password?</a>
                            </div>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                            />
                        </div>

                        <button type="submit" className="btn primary full-width" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>

                    <div className="login-footer">
                        <p>Don't have an account? <a href="https://wa.me/+256758435163" target="_blank" rel="noopener noreferrer">Contact Sales</a></p>
                    </div>
                </div>
            </div>
        </div>
    );
}
