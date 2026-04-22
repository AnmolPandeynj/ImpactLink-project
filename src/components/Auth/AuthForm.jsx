import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, Zap, Shield, Activity } from 'lucide-react';
import { signUp, logIn, resetPassword, sendEmailVerification } from '../../services/firebase';
import { useSearchParams, useNavigate } from 'react-router-dom';

const FEATURES = [
  { icon: Zap, label: 'Gemini AI Engine', desc: 'Real-time intelligence orchestration' },
  { icon: Activity, label: 'Live Incident Map', desc: 'Precise geospatial clustering' },
  { icon: Shield, label: 'Secure & Encrypted', desc: 'Firebase-grade protection' },
];

export default function AuthForm({ onSuccess }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const intent = searchParams.get('intent') || 'admin';
  const initialMode = searchParams.get('mode') || 'login';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [mode, setMode] = useState(initialMode);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMsg('');
    try {
      if (mode === 'signup') {
        const userCred = await signUp(email, password);
        await sendEmailVerification(userCred.user);
        setMsg('Verification email sent! Please check your inbox.');
        // Soft enforcement: we'll let them log in anyway if they switch to login, 
        // or you can configure this to auto-redirect.
      } else if (mode === 'reset') {
        await resetPassword(email);
        setMsg('Password reset link sent! Check your email.');
      } else {
        await logIn(email, password);
        if (onSuccess) onSuccess();
        else navigate(`/setup?intent=${intent}`);
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(.*\)/, '').trim());
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';
  const isReset = mode === 'reset';

  return (
    <div className="auth-form-root">
      {/* Left Panel — Branding & Features */}
      <div className="auth-left-panel">
        <div className="auth-left-inner">
          <div className="auth-brand" onClick={() => window.location.href = '/'} style={{ cursor: 'pointer' }}>
            <div className="auth-brand-icon">
              <div className="brand-dot" />
            </div>
            <span className="auth-brand-name">ImpactLink</span>
          </div>

          <div className="auth-tagline">
            <h2 className="auth-left-title">
              {intent === 'volunteer' ? 'Join the field' : 'Command the'}<br />
              <span className="auth-left-title-gradient">
                {intent === 'volunteer' ? 'Response Team' : 'Humanitarian Grid'}
              </span>
            </h2>
            <p className="auth-left-desc">
              AI-driven resource allocation for disaster response, field operations, and NGO coordination.
            </p>
          </div>

          <div className="auth-feature-list">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="auth-feature-item">
                <div className="auth-feature-icon">
                  <Icon size={14} strokeWidth={2} />
                </div>
                <div>
                  <div className="auth-feature-label">{label}</div>
                  <div className="auth-feature-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Decorative Grid */}
          <div className="auth-grid-deco" aria-hidden="true">
            {[...Array(9)].map((_, i) => (
              <motion.div
                key={i}
                className="auth-grid-node"
                animate={{ opacity: [0.1, 0.5, 0.1] }}
                transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="auth-right-panel">
        {/* Toggle stays outside animation so it doesn't fade */}
        <div className="auth-right-outer">
          <div className="auth-mode-toggle">
            <button
              className={`auth-toggle-btn ${isLogin ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              Sign In
            </button>
            <button
              className={`auth-toggle-btn ${!isLogin ? 'active' : ''}`}
              onClick={() => setMode('signup')}
            >
              Sign Up
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="auth-right-inner"
            >
            <div className="auth-form-header">
              <h3 className="auth-form-title">
                {isReset ? 'Reset Password' : isLogin ? 'Welcome back' : 'Create account'}
              </h3>
              <p className="auth-form-subtitle">
                {isReset ? 'Enter your email to receive a reset link.' : isLogin ? (intent==='volunteer' ? 'Access your field portal.' : 'Access your command center.') : 'Start orchestrating resources today.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form-fields">
              {/* Email */}
              <div className="auth-input-wrap">
                <label className="auth-label">Email Address</label>
                <div className="auth-input-box">
                  <Mail size={15} className="auth-input-icon" />
                  <input
                    type="email"
                    placeholder="you@organization.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="auth-input"
                  />
                </div>
              </div>

              {/* Password */}
              {!isReset && (
                <div className="auth-input-wrap">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="auth-label">Password</label>
                    {isLogin && (
                      <button 
                        type="button" 
                        onClick={() => setMode('reset')}
                        style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="auth-input-box">
                    <Lock size={15} className="auth-input-icon" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder={isLogin ? 'Enter your password' : 'Create a strong password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!isReset}
                      className="auth-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="auth-pass-toggle"
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Error and Success Messages */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="auth-error"
                  >
                    <div className="auth-error-dot" />
                    {error}
                  </motion.div>
                )}
                {msg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="auth-error"
                    style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)' }}
                  >
                    <div className="auth-error-dot" style={{ background: '#34d399', boxShadow: '0 0 5px #34d399' }} />
                    {msg}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                className="auth-submit-btn"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    {isReset ? 'Send Reset Link' : isLogin ? (intent === 'volunteer' ? 'Access Portal' : 'Access Command Center') : 'Get Started'}
                    <ArrowRight size={16} />
                  </>
                )}
              </motion.button>
            </form>

            {/* Footer switch */}
            <p className="auth-switch-text">
              {isReset ? "Remember your password?" : isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => setMode(isLogin ? 'signup' : 'login')}
              >
                {isLogin ? 'Sign up free' : 'Sign in'}
              </button>
            </p>

            <div className="auth-trust-badge">
              <Shield size={11} />
              Secured by Firebase Authentication
            </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
