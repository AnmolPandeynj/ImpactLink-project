import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionTemplate, useMotionValue, useScroll, useTransform } from 'framer-motion';
import { Zap, Users, Globe, Database, Cpu, Activity, ShieldCheck, Target, BarChart3, X, Sparkles, Lightbulb, ArrowRight, CheckCircle2 } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { logout } from '../services/firebase';
import './LandingPage.css';

export default function LandingPage() {
  const { firebaseUser, appUser } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authType, setAuthType] = useState('signup');
  const [currentTourStep, setCurrentTourStep] = useState(-1); // -1 = closed
  const [infoModal, setInfoModal] = useState(null); // 'privacy', 'license', 'about', 'docs', 'faq'
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Mouse tracking for button glow
  let mouseX = useMotionValue(0);
  let mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    let { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const backgroundVideoPlaylist = [
    "/volunteer_demo_video.mp4",
    "/volunteer_demo_video_2.mp4",
    "/volunteer_demo_video_3.mp4"
  ];

  const handleAuthSuccess = () => {
    navigate('/dashboard');
  };

  const openAuth = (type) => {
    navigate(`/auth?type=${type}`);
  };

  const tourSteps = [
    { title: "Mission Control", content: "Analyze and orchestrate resources across India with AI-driven precision." },
    { title: "Tactical Visibility", content: "Eliminate misallocation by aggregating scattered field reports into a single source of truth." },
    { title: "Gemini 1.5 Flash", content: "Leverage Google's latest model for real-time impact simulation and responder matching." },
    { title: "Ready for Impact?", content: "Sign up now to access the live command center and start allocating resources effectively." }
  ];

  const infoContent = {
    privacy: {
      title: "Privacy Policy",
      content: "ImpactLink is committed to protecting sensitive humanitarian data. We adhere to high security standards, ensuring that all field reports and PII are encrypted at rest and in transit. Data is used solely for the purpose of resource allocation and disaster response optimization."
    },
    license: {
      title: "Project License",
      content: "This project is developed as part of the Google Solutions Hackathon 2026. Code is provided under the MIT License for educational and demonstration purposes. All rights to the ImpactLink brand and architecture are reserved."
    },
    about: {
      title: "About ImpactLink",
      content: "ImpactLink was born from the need to synchronize fragmented NGO efforts. By bridging the gap between field surveys and high-level orchestration, we ensure that aid reaches the right sectors at the right time."
    },
    docs: {
      title: "Documentation",
      content: "The ImpactLink API and Integration guides are currently being finalized. Our documentation will cover Gemini orchestration layers, Map clustering logic, and secure Data Ingestion protocols."
    },
    faq: {
      title: "Frequently Asked Questions",
      content: "How does the AI work? Is the map data real-time? How do I onboard my NGO? Find answers to these and more in our upcoming Help Center."
    }
  };

  return (
    <div className="landing-container">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="nav-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="logo-icon" />
          ImpactLink
        </div>

        <div className="nav-links" style={{ gap: '2rem' }}>
          <div className="nav-item-container">
            <button className="btn-text">Product</button>
            <div className="nav-dropdown">
              <button className="dropdown-link" onClick={() => setInfoModal('docs')}>
                <strong>Features</strong> View core orchestration capabilities.
              </button>
              <button className="dropdown-link" onClick={() => setCurrentTourStep(0)}>
                <strong>Guided Tour</strong> Walk through the mission logic.
              </button>
              <button className="dropdown-link" onClick={() => openAuth('signup')}>
                <strong>Simulator</strong> Access the AI decision engine.
              </button>
            </div>
          </div>

          <div className="nav-item-container">
            <button className="btn-text">Resources</button>
            <div className="nav-dropdown">
              <button className="dropdown-link" onClick={() => setInfoModal('docs')}>
                <strong>Documentation</strong> API and Integration guides.
              </button>
              <button className="dropdown-link" onClick={() => setInfoModal('faq')}>
                <strong>FAQ</strong> Common questions and answers.
              </button>
            </div>
          </div>

          <button onClick={() => setInfoModal('about')} className="btn-text">About</button>
          
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }} />
          
          {firebaseUser ? (
            <>
              <button 
                onClick={() => navigate(appUser?.role === 'Volunteer' ? '/volunteer' : '/dashboard')} 
                className="btn-nav-primary"
              >
                Go to Portal
              </button>
              <button onClick={handleLogout} className="btn-text">Log out</button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/auth')} className="btn-text">Log in</button>
              <button onClick={() => navigate('/auth?intent=volunteer')} className="btn-nav-primary">Join as Volunteer</button>
            </>
          )}
        </div>
      </nav>

      {/* Decorative Video Background */}
      <div className="landing-bg-video-wrapper">
        <video 
          key={backgroundVideoPlaylist[currentVideoIndex]}
          autoPlay 
          muted 
          playsInline 
          onEnded={() => setCurrentVideoIndex((prev) => (prev + 1) % backgroundVideoPlaylist.length)}
          className="landing-bg-video"
        >
          <source src={backgroundVideoPlaylist[currentVideoIndex]} type="video/mp4" />
        </video>
        <div className="landing-bg-video-overlay" />
      </div>

      {/* Hero Section */}
      <header className="hero-section">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hero-content"
        >
          <motion.div 
            className="badge"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            <span className="dot" /> Now active for Google Solutions Hackathon
          </motion.div>
          <motion.h1 
            className="hero-main-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            Extreme Orchestration <br />
            <span>for Smart Resource Allocation</span>
          </motion.h1>
          <motion.p 
            className="hero-main-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Eliminating resource misallocation through AI-driven visibility. <br />
            The intelligence layer for localized disaster response.
          </motion.p>
          <div className="hero-ctas" onMouseMove={handleMouseMove}>
            {firebaseUser ? (
              <motion.button 
                onClick={() => navigate(appUser?.role === 'Volunteer' ? '/volunteer' : '/dashboard')} 
                className="btn-hero-primary"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Return to Mission <ArrowRight size={18} />
              </motion.button>
            ) : (
              <motion.div 
                style={{ display: 'flex', gap: '1.5rem', width: '100%', justifyContent: 'center' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                <motion.button 
                  onClick={() => navigate('/auth?intent=admin')} 
                  style={{ flex: 1, maxWidth: '280px' }}
                  className="btn-hero-primary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Command Control <ArrowRight size={18} />
                </motion.button>
                <motion.button 
                  onClick={() => navigate('/auth?intent=volunteer')} 
                  style={{ 
                    flex: 1, maxWidth: '280px', background: 'transparent', 
                    border: '1px solid rgba(255,255,255,0.2)', color: '#fff' 
                  }}
                  className="btn-hero-primary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Volunteer Portal <Zap size={18} style={{ marginLeft: '8px' }} />
                </motion.button>
              </motion.div>
            )}
            <motion.div 
              className="btn-glow-wrapper group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <motion.div
                className="btn-glow-effect"
                style={{
                  background: useMotionTemplate`
                    radial-gradient(
                      350px circle at ${mouseX}px ${mouseY}px,
                      rgba(99, 102, 241, 0.15),
                      transparent 80%
                    )
                  `,
                }}
              />
              <motion.button 
                onClick={() => setCurrentTourStep(0)} 
                className="btn btn-interactive-demo"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Interactive Demo
              </motion.button>
            </motion.div>
          </div>
        </motion.div>

        {/* Live Visualizer Section */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
          className="visualizer-container"
        >
          <motion.div 
            className="visualizer-border"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.4 }}
          >
            <LiveVisualizer />
          </motion.div>
        </motion.div>
      </header>

      {/* Capabilities */}
      <section className="features-section" id="capabilities">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{ textAlign: 'center', marginBottom: '5rem' }}
        >
          <div className="section-label">Enterprise Architecture</div>
          <h2 className="section-title">Orchestrating Humanitarian Logistics at Scale.</h2>
          <p className="section-subtitle">
            ImpactLink combines real-time data ingestion with strategic AI reasoning to solve the "Last Mile" problem in disaster relief.
          </p>
        </motion.div>
        
        <div className="features-grid">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <FeatureCard 
              icon={<Database size={24} />}
              color="#6366f1"
              title="Multimodal Field Ingestion"
              description="Convert paper surveys, WhatsApp voice notes, and damage photos into structured missions using Gemini 1.5 Flash's multimodal reasoning."
              tags={["ZERO DATA LOSS", "GEMINI 1.5"]}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <FeatureCard 
              icon={<Activity size={24} />}
              color="#0ea5e9"
              title="Dual-Pass Allocation Engine"
              description="Maximize resident-first greedy assignments followed by mobile-fleet dispatch to ensure 100% of critical sectors are covered by optimal responders."
              tags={["OPTIMAL MATCH", "DETERMINISTIC"]}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <FeatureCard 
              icon={<Zap size={24} />}
              color="#f59e0b"
              title="Dynamic Urgency Decay"
              description="Algorithmic prioritization that accounts for temporal decay—automatically escalating stale missions to prevent 'silent' humanitarian crises."
              tags={["TEMPORAL PRIORITY", "REAL-TIME"]}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <FeatureCard 
              icon={<Cpu size={24} />}
              color="#10b981"
              title="Temporal Orchestration"
              description="AI-assisted timeline planning that infers logistical bottlenecks, creating adaptive mission paths that respond to real-world deployment delays."
              tags={["ADAPTIVE LOGISTICS", "AI-PLANNER"]}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <FeatureCard 
              icon={<Users size={24} />}
              color="#ec4899"
              title="Semantic Skill Mapping"
              description="Match responders to missions based on semantic skill depth (e.g., Trauma vs First Aid) using vector-based AI embeddings instead of keywords."
              tags={["AI-MATCHING", "EMBEDDINGS"]}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <FeatureCard 
              icon={<Globe size={24} />}
              color="#3b82f6"
              title="Fleet-Sync Coordination"
              description="Cross-fleet intelligence that synchronizes multiple NGO logistics, ensuring aid isn't duplicated in easy-to-reach zones while remote areas suffer."
              tags={["ZERO REDUNDANCY", "MULTI-NGO"]}
            />
          </motion.div>
        </div>
      </section>

      {/* The Gemini Edge - New Section */}
      <section className="gemini-edge-section">
        <div className="edge-container">
          <div className="edge-visual">
            <div className="gemini-orb">
              <Sparkles size={48} color="#fff" />
            </div>
            <div className="orb-rings">
              <div className="ring" />
              <div className="ring" />
              <div className="ring" />
            </div>
          </div>
          <div className="edge-content">
            <div className="section-label" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              Technological Edge
            </div>
            <h2 className="section-title" style={{ fontSize: '2.5rem', textAlign: 'left' }}>
              Powered by Gemini 1.5 Flash.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.8', marginBottom: '2rem', fontSize: '1.1rem' }}>
              We leverage Google's most efficient multimodal model to bridge the gap between fragmented field reality and strategic command decisions.
            </p>
            <div className="edge-features">
              <div className="edge-feat-item">
                <div className="feat-dot" />
                <span><strong>1M Context Window:</strong> Ingesting months of field reports for long-term pattern detection.</span>
              </div>
              <div className="edge-feat-item">
                <div className="feat-dot" />
                <span><strong>Sub-Second Latency:</strong> Real-time analysis for rapid response units in active zones.</span>
              </div>
              <div className="edge-feat-item">
                <div className="feat-dot" />
                <span><strong>Multimodal Reasoner:</strong> Understanding the visual context of disaster damage directly from field photos.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="process-section">
        <div className="process-grid">
          <motion.div 
            className="process-visual"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="pulse-circle" />
            <div className="scan-line" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="process-content">
              <div className="section-label">The Intelligence Loop</div>
              <h2 className="section-title">From scattered data to <br /> orchestrated response.</h2>
              <ul className="process-list">
                <motion.li
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.6 }}
                  viewport={{ once: true }}
                >
                  <div className="list-icon"><Database size={16} /></div>
                  <div><strong>Ingest:</strong> Gemini parses unstructured field reports automatically.</div>
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  viewport={{ once: true }}
                >
                  <div className="list-icon"><Activity size={16} /></div>
                  <div><strong>Analyze:</strong> Real-time divergence detection for allocation gaps.</div>
                </motion.li>
                <motion.li
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  viewport={{ once: true }}
                >
                  <div className="list-icon"><Globe size={16} /></div>
                  <div><strong>Deploy:</strong> Smart matching system for volunteers and NGOs.</div>
                </motion.li>
              </ul>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats / Impact */}
      <section className="impact-section">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1 }}
          style={{ textAlign: 'center', marginBottom: '5rem' }}
        >
          <div className="section-label">The Outcome</div>
          <h2 className="section-title">Measurable Strategic Superiority.</h2>
        </motion.div>
        <div className="impact-grid">
           <motion.div 
              className="stat-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0 }}
              viewport={{ once: true, margin: "-100px" }}
           >
              <div className="stat-val">100%</div>
              <div className="stat-label">Data Visibility</div>
              <p className="stat-desc">Zero dark spots in field report ingestion through automated AI digitization.</p>
           </motion.div>
           <motion.div 
              className="stat-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true, margin: "-100px" }}
           >
              <div className="stat-val">2.4x</div>
              <div className="stat-label">Faster Deployment</div>
              <p className="stat-desc">Reduction in mobilization time for rapid response units via smart matching.</p>
           </motion.div>
           <motion.div 
              className="stat-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true, margin: "-100px" }}
           >
              <div className="stat-val">0</div>
              <div className="stat-label">Resource Waste</div>
              <p className="stat-desc">Eliminating duplicate aid shipments through real-time divergence detection.</p>
           </motion.div>
        </div>
      </section>

      <motion.footer 
        className="landing-footer"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
      >
        <div className="footer-content">
          <motion.div 
            className="footer-brand"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="footer-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ cursor: 'pointer' }}>
              <div className="logo-icon" /> ImpactLink
            </div>
            <p>Extreme orchestration for smart resource allocation. Built for the Google Solutions Hackathon 2026.</p>
          </motion.div>

          <motion.div 
            className="footer-col"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            viewport={{ once: true }}
          >
            <h4>Product</h4>
            <div className="footer-links">
              <button className="footer-link" onClick={() => openAuth('signup')}>Features</button>
              <button className="footer-link" onClick={() => setCurrentTourStep(0)}>Interactive Demo</button>
              <button className="footer-link" onClick={() => openAuth('signup')}>Simulator</button>
              <button className="footer-link" onClick={() => setInfoModal('docs')}>Integrations</button>
            </div>
          </motion.div>

          <motion.div 
            className="footer-col"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
          >
            <h4>Resources</h4>
            <div className="footer-links">
              <button className="footer-link" onClick={() => setInfoModal('docs')}>Documentation</button>
              <button className="footer-link" onClick={() => setInfoModal('faq')}>FAQ</button>
              <button className="footer-link" onClick={() => setInfoModal('docs')}>API Reference</button>
              <button className="footer-link" onClick={() => setInfoModal('about')}>Status</button>
            </div>
          </motion.div>

          <motion.div 
            className="footer-col"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            viewport={{ once: true }}
          >
            <h4>Company</h4>
            <div className="footer-links">
              <button className="footer-link" onClick={() => setInfoModal('about')}>About Us</button>
              <button className="footer-link" onClick={() => setInfoModal('about')}>Impact</button>
            </div>
          </motion.div>

          <motion.div 
            className="footer-col"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <h4>Legal</h4>
            <div className="footer-links">
              <button className="footer-link" onClick={() => setInfoModal('privacy')}>Privacy Policy</button>
              <button className="footer-link" onClick={() => setInfoModal('privacy')}>Terms of Service</button>
              <button className="footer-link" onClick={() => setInfoModal('license')}>License</button>
              <button className="footer-link" onClick={() => setInfoModal('privacy')}>Security</button>
            </div>
          </motion.div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 ImpactLink Architecture. All rights reserved.</p>
          <div className="status-indicator">
            <div className="status-dot" />
            V1.5 FLASH_ENGINE: NOMINAL
          </div>
        </div>
      </motion.footer>


      {/* Info Modals */}
      <AnimatePresence>
        {infoModal && (
          <div className="auth-overlay">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="auth-modal info-modal"
            >
              <button onClick={() => setInfoModal(null)} className="close-auth">
                <X size={20} />
              </button>
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#fff' }}>{infoContent[infoModal].title}</h2>
                <div className="info-content">
                  {infoContent[infoModal].content}
                </div>
                <button 
                  onClick={() => setInfoModal(null)} 
                  className="btn btn-primary" 
                  style={{ marginTop: '2.5rem', width: '100%', justifyContent: 'center' }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Guided Tour Overlay */}
      <AnimatePresence>
        {currentTourStep >= 0 && (
          <div className="tour-overlay">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="tour-card"
            >
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                STEP {currentTourStep + 1} / 4
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#fff' }}>{tourSteps[currentTourStep].title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9375rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                {tourSteps[currentTourStep].content}
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  className="btn" 
                  style={{ flex: 1, border: '1px solid rgba(255,255,255,0.1)' }}
                  onClick={() => setCurrentTourStep(-1)}
                >
                  Exit
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 2, justifyContent: 'center' }}
                  onClick={() => {
                    if (currentTourStep < 3) setCurrentTourStep(prev => prev + 1);
                    else {
                      setCurrentTourStep(-1);
                      openAuth('signup');
                    }
                  }}
                >
                  {currentTourStep === 3 ? "Get Started" : "Next Step"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LiveVisualizer() {
  const [activeQueue, setActiveQueue] = React.useState(0);

  // Cycle through queue items
  useEffect(() => {
    const timer = setInterval(() => setActiveQueue(p => (p + 1) % 6), 3000);
    return () => clearInterval(timer);
  }, []);

  const queueItems = [
    { title: 'Infrastructure Damage - Delhi Cluster 1 Command Hub', score: '9.3', type: 'CRITICAL', time: '26d ago' },
    { title: 'Food Insecurity - New Delhi Corridor Command Hub', score: '8.8', type: 'CRITICAL', time: '3d ago' },
    { title: 'Medical Shortage - Mumbai Coast Command Hub', score: '8.8', type: 'CRITICAL', time: '8d ago' },
    { title: 'Infrastructure Damage - Indore Central Command Hub', score: '8.8', type: 'CRITICAL', time: '1mo ago' },
    { title: 'Food Insecurity - Hyderabad Heights Command Hub', score: '8.7', type: 'CRITICAL', time: '27d ago' },
    { title: 'Medical Shortage - Delhi Cluster 1 Command Hub', score: '8.7', type: 'CRITICAL', time: '1mo ago' },
  ];

  const hotspots = [
    { x: '45%', y: '45%', label: 'Indore', size: 'lg', delay: 0 },
    { x: '48%', y: '25%', label: 'Delhi', size: 'lg', delay: 0.5 },
    { x: '50%', y: '28%', label: 'New Delhi', size: 'md', delay: 1 },
    { x: '25%', y: '55%', label: 'Mumbai', size: 'md', delay: 1.5 },
    { x: '48%', y: '65%', label: 'Hyderabad', size: 'sm', delay: 2 },
  ];

  const feedLines = [
    { time: '14:02', text: 'Gemini structured paper survey from Sector 4', color: '#10b981' },
    { time: '14:03', text: 'Divergence detected in Medical Supply vs Need', color: '#f59e0b' },
    { time: '14:05', text: 'Lateral shift recommended: Sector 2 → Sector 5', color: '#818cf8' },
  ];

  return (
    <div className="dash-preview">
      {/* ── Top Chrome Bar (Removed) ── */}

      {/* ── Metrics Bar ── */}
      <div className="dp-metrics-bar">
        <div className="dp-metric">
          <div className="dp-metric-label">ACTIVE INCIDENTS</div>
          <motion.div
            className="dp-metric-val"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            800
          </motion.div>
        </div>
        <div className="dp-metric">
          <div className="dp-metric-label">VISIBILITY INDEX</div>
          <div className="dp-metric-val">
            100% <span className="dp-metric-tag dp-tag-green">NOMINAL</span>
          </div>
        </div>
        <div className="dp-metric">
          <div className="dp-metric-label">ALLOCATION EFFICIENCY</div>
          <div className="dp-metric-val">43.4%</div>
        </div>
        <div className="dp-metric-action">
          <div className="dp-btn-ghost"><BarChart3 size={12} style={{marginRight: '6px'}}/> Full Report</div>
        </div>
      </div>

      {/* ── Main Content: Map + Sidebar ── */}
      <div className="dp-body">
        {/* Map Area */}
        <div className="dp-map-area">
          <div className="dp-map-label" style={{ color: '#aaa', textTransform: 'uppercase' }}>
            <Activity size={10} style={{ marginRight: '4px' }} /> LIVE RESOURCE ALLOCATION NETWORK
          </div>

          {/* Simple geo-text overlay for realism */}
          <div className="dp-geo-text" style={{ top: '10%', left: '5%' }}>Azerbaijan</div>
          <div className="dp-geo-text" style={{ top: '20%', left: '20%' }}>Turkmenistan</div>
          <div className="dp-geo-text" style={{ top: '25%', left: '40%' }}>Tajikistan</div>
          <div className="dp-geo-text" style={{ top: '35%', left: '15%' }}>Iran</div>
          <div className="dp-geo-text" style={{ top: '40%', left: '35%' }}>Pakistan</div>
          <div className="dp-geo-text" style={{ top: '30%', left: '70%' }}>China</div>
          <div className="dp-geo-text" style={{ top: '55%', left: '42%', fontSize: '14px', color: '#fff', fontWeight: 500 }}>India</div>
          <div className="dp-geo-text" style={{ top: '55%', left: '60%' }}>Bangladesh</div>
          <div className="dp-geo-text" style={{ top: '75%', left: '50%' }}>Sri Lanka</div>
          <div className="dp-geo-text" style={{ top: '65%', left: '75%' }}>Thailand</div>

          {/* Map Controls */}
          <div className="dp-map-zoom-control">
            <div className="dp-zoom-btn">+</div>
            <div className="dp-zoom-btn">-</div>
          </div>
          
          <div className="dp-map-zoom" style={{ top: '30px', left: '16px', right: 'unset' }}>ZOOM: 4</div>

          {/* Animated Hotspots */}
          {hotspots.map((h, i) => (
            <div
              key={i}
              className="dp-hotspot-wrap"
              style={{ left: h.x, top: h.y }}
            >
              <motion.div
                className={`dp-hotspot-ring dp-ring-${h.size}`}
                animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: h.delay }}
              />
              <motion.div
                className="dp-hotspot-core"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: h.delay }}
              />
              <div className="dp-hotspot-label">{h.label}</div>
            </div>
          ))}

          {/* Animated dispatch line */}
          <svg className="dp-dispatch-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <motion.line
              x1="45" y1="45" x2="48" y2="25"
              stroke="#0ea5e9"
              strokeWidth="0.3"
              strokeDasharray="2 2"
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: 1 }}
            />
            <motion.line
              x1="45" y1="45" x2="25" y2="55"
              stroke="#0ea5e9"
              strokeWidth="0.3"
              strokeDasharray="2 2"
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: 2 }}
            />
          </svg>

          {/* Dispatch Packet */}
            <motion.div
              className="dp-dispatch-packet"
              style={{ background: '#0ea5e9', boxShadow: '0 0 8px #0ea5e9' }}
              animate={{
                left: ['45%', '48%'],
                top: ['45%', '25%'],
                opacity: [1, 0],
                scale: [1, 1.8],
              }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
            />

          {/* Mode badge */}
          <div className="dp-map-modes" style={{ position: 'absolute', bottom: '16px', left: '16px', display: 'flex', gap: '8px' }}>
            <div className="dp-map-mode">
              <div className="dp-mode-dot dp-mode-dot-active" /> Mode: STRATEGIC
            </div>
            <div className="dp-map-mode">
              <div className="dp-mode-square" /> Show Noise
            </div>
          </div>
          
          <div className="dp-map-google">Google</div>
        </div>

        {/* Sidebar: Priority Queue */}
        <div className="dp-sidebar">
          <div className="dp-sidebar-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={10} color="#666" /> PRIORITY QUEUE
            </span>
            <span className="dp-sidebar-dots">⋯</span>
          </div>

          <div className="dp-queue-list">
            {queueItems.map((item, i) => (
              <motion.div
                key={i}
                className={`dp-queue-item ${i === activeQueue ? 'dp-queue-active' : ''}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
              >
                <div className="dp-queue-row">
                  <div className="dp-queue-title">
                    <motion.span
                      className="dp-queue-pulse"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                    {item.title}
                  </div>
                  <span className="dp-queue-score">{item.score}</span>
                </div>
                <div className="dp-queue-meta">
                  <span>{item.time}</span>
                  <span className="dp-queue-chevron">›</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* AI Feed */}
          <div className="dp-ai-feed">
            <div className="dp-ai-feed-header">
              <Cpu size={10} color="#34d399" /> LIVE AI INGESTION FEED
            </div>
            {feedLines.map((line, i) => (
              <motion.div
                key={i}
                className="dp-feed-line"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 + i * 0.8 }}
              >
                <span className="dp-feed-time">[{line.time}]</span>
                <span style={{ color: i === 0 ? line.color : 'rgba(255,255,255,0.3)' }}>
                  {line.text}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


function FeatureCard({ icon, title, description, tags = [], color = "#6366f1" }) {
  return (
    <div className="feature-card" style={{ borderColor: `${color}33` }}>
      <div className="feature-icon" style={{ background: `${color}1A`, borderColor: `${color}33`, color: color }}>
        {icon}
      </div>
      <div className="feature-tags">
        {tags.map(tag => <span key={tag} className="f-tag" style={{ background: `${color}1A`, color: color }}>{tag}</span>)}
      </div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-description">{description}</p>
      <div className="card-bg-glow" style={{ background: `radial-gradient(circle at 50% 0%, ${color}10, transparent 70%)` }} />
    </div>
  );
}
