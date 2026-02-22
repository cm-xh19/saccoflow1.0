import { useState, useEffect } from 'react';
import { supabase } from './src/lib/supabase';
import './index.css';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // Supabase automatically picks up the token from the URL hash
        // and establishes a session. We just need to wait for it.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
                setReady(true);
            }
        });

        // Also check if there's already a session (e.g. page was refreshed)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setReady(true);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;

            setMessage('Password set successfully! You can now log in.');
            setTimeout(() => {
                window.location.href = '/';
            }, 2500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-header">
                <div className="logo" style={{ color: '#fff' }}>SaccoFlow</div>
            </div>

            <div className="login-container">
                <div className="login-card reveal delay-1">
                    <h2>Set Your Password</h2>
                    <p>Create a secure password for your SaccoFlow account.</p>

                    {!ready && (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#718096' }}>
                            Verifying your invite link...
                        </div>
                    )}

                    {error && (
                        <div style={{ background: '#fce8e8', color: '#c53030', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                            {error}
                        </div>
                    )}

                    {message && (
                        <div style={{ background: '#e6f4ea', color: '#2d7a47', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                            {message}
                        </div>
                    )}

                    {ready && !message && (
                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="form-group">
                                <label htmlFor="new-password">New Password</label>
                                <input
                                    type="password"
                                    id="new-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min 6 characters"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirm-password">Confirm Password</label>
                                <input
                                    type="password"
                                    id="confirm-password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter your password"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <button type="submit" className="btn primary full-width" disabled={loading}>
                                {loading ? 'Setting password...' : 'Set Password & Continue'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
