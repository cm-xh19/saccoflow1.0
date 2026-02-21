import { useState } from 'react';
import './index.css';

interface LoginProps {
    onBack: () => void;
    onLogin: (role: string) => void;
}

export default function Login({ onBack, onLogin }: LoginProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email === 'admin@saccoflow.com') {
            onLogin('superadmin');
        } else if (email === 'admin@sacco.com') {
            onLogin('saccoadmin');
        } else {
            // Default to member
            onLogin('member');
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

                        <button type="submit" className="btn primary full-width">Sign in</button>
                    </form>

                    <div className="login-footer">
                        <p>Don't have an account? <a href="https://wa.me/+256758435163" target="_blank" rel="noopener noreferrer">Contact Sales</a></p>
                    </div>
                </div>
            </div>
        </div>
    );
}
