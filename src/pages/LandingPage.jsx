import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionTemplate, useMotionValue } from 'framer-motion';
import { 
  Zap, 
  Activity, 
  Target, 
  Cpu, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Globe,
  Database,
  BarChart3,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthForm from '../components/Auth/AuthForm';
import { auth, onAuthStateChanged, logout } from '../services/firebase';
import './LandingPage.css';

export default function LandingPage() {
  const [currentTourStep, setCurrentTourStep] = useState(-1); // -1 = closed
  const [infoModal, setInfoModal] = useState(null); // 'privacy', 'license', 'about', 'docs', 'faq'
  const [currentUser, setCurrentUser] = useState(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const navigate = useNavigate();

  const backgroundVideoPlaylist = [
    "/volunteer_demo_video.mp4",
    "/volunteer_demo_video_2.mp4",
    "/volunteer_demo_video_3.mp4"
  ];

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    if (auth) {
      try {
        await logout();
        setCurrentUser(null);
      } catch (err) {
        console.error('Logout error:', err);
      }
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

  const openAuthAdmin = (type = 'signup') => {
    navigate(`/auth?intent=admin&mode=${type}`);
  };

  const openAuthVolunteer = (type = 'signup') => {
    navigate(`/auth?intent=volunteer&mode=${type}`);
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
              <button className="dropdown-link" onClick={() => openAuthAdmin()}>
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
          
          {currentUser ? (
            <>
              <button onClick={() => navigate('/dashboard')} className="btn-nav-primary">Command Center</button>
              <button onClick={handleLogout} className="btn-text">Log out</button>
            </>
          ) : (
            <>
              <button onClick={() => openAuthAdmin('login')} className="btn-text">Admin Login</button>
              <button onClick={() => openAuthVolunteer('login')} className="btn-text">Volunteer Login</button>
              <button onClick={() => openAuthAdmin('signup')} className="btn-nav-primary">Command Center</button>
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="hero-content"
        >
          <div className="badge">
            <span className="dot" /> Now active for Google Solutions Hackathon
          </div>
          <h1 className="hero-main-title">
            Extreme Orchestration <br />
            <span>for Smart Resource Allocation</span>
          </h1>
          <p className="hero-main-subtitle">
            Eliminating resource misallocation through AI-driven visibility. <br />
            The intelligence layer for localized disaster response.
          </p>
          <div className="hero-ctas" onMouseMove={handleMouseMove}>
            {currentUser ? (
              <button onClick={() => navigate('/setup')} className="btn-hero-primary">
                Return to Dashboard <ArrowRight size={18} />
              </button>
            ) : (
              <>
                <button onClick={() => openAuthAdmin('signup')} className="btn-hero-primary">
                  Access Command Center <ArrowRight size={18} />
                </button>
                <button onClick={() => openAuthVolunteer('signup')} className="btn-hero-secondary" style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', padding: '0 1.5rem', borderRadius: '8px',
                  color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600
                }}>
                  Volunteer Portal <ArrowRight size={18} />
                </button>
              </>
            )}
            <div className="btn-glow-wrapper group">
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
              <button 
                onClick={() => setCurrentTourStep(0)} 
                className="btn btn-interactive-demo"
              >
                Interactive Demo
              </button>
            </div>
          </div>
        </motion.div>

        {/* Live Visualizer Section */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="visualizer-container"
        >
          <div className="visualizer-border">
            <LiveVisualizer />
          </div>
        </motion.div>
      </header>

      {/* Feature Grid */}
      <section className="features-section">
        <div className="section-label">Capabilities</div>
        <h2 className="section-title">Built for immediate tactical impact.</h2>
        
        <div className="features-grid">
          <FeatureCard 
            icon={<Target size={24} color="#6366f1" />}
            title="Localized Ingestion"
            description="Gemini-powered parsing of hand-written reports, photos, and unstructured field notes."
          />
          <FeatureCard 
            icon={<Activity size={24} color="#0ea5e9" />}
            title="Divergence Detection"
            description="Our priority engine identifies where resources are being sent vs. where they are actually needed."
          />
          <FeatureCard 
            icon={<Cpu size={24} color="#a855f7" />}
            title="Simulated Impact"
            description="Test the outcome of resource shifts before deployment using our AI-driven decision engine."
          />
        </div>
      </section>

      {/* How it Works / Process */}
      <section className="process-section">
        <div className="process-grid">
          <div className="process-visual">
            <div className="pulse-circle" />
            <div className="scan-line" />
          </div>
          <div className="process-content">
            <div className="section-label">The Intelligence Loop</div>
            <h2 className="section-title">From scattered data to <br /> orchestrated response.</h2>
            <ul className="process-list">
              <li>
                <div className="list-icon"><CheckCircle2 size={16} /></div>
                <div><strong>Aggregate:</strong> Connect multiple fragmented community effort logs.</div>
              </li>
              <li>
                <div className="list-icon"><ShieldCheck size={16} /></div>
                <div><strong>Verify:</strong> Deterministic ranking of urgent local priorities.</div>
              </li>
              <li>
                <div className="list-icon"><Globe size={16} /></div>
                <div><strong>Deploy:</strong> Smart matching system for volunteers and NGOs.</div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Stats / Impact */}
      <section className="impact-section">
        <div className="impact-grid">
           <div className="stat-card">
              <div className="stat-val">100%</div>
              <div className="stat-label">Data Visibility</div>
           </div>
           <div className="stat-card">
              <div className="stat-val">2.4x</div>
              <div className="stat-label">Faster Deployment</div>
           </div>
           <div className="stat-card">
              <div className="stat-val">0</div>
              <div className="stat-label">Resource Waste</div>
           </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ cursor: 'pointer' }}>
              <div className="logo-icon" /> ImpactLink
            </div>
            <p>Extreme orchestration for smart resource allocation. Built for the Google Solutions Hackathon 2026.</p>
          </div>

          <div className="footer-col">
            <h4>Product</h4>
            <div className="footer-links">
              <button className="footer-link" onClick={() => openAuthAdmin('signup')}>Features</button>
              <button className="footer-link" onClick={() => setCurrentTourStep(0)}>Interactive Demo</button>
              <button className="footer-link" onClick={() => openAuthAdmin('signup')}>Simulator</button>
              <button className="footer-link" onClick={() => setInfoModal('docs')}>Integrations</button>
            </div>
          </div>

          <div className="footer-col">
            <h4>Resources</h4>
            <div className="footer-links">
              <button className="footer-link" onClick={() => setInfoModal('docs')}>Documentation</button>
              <button className="footer-link" onClick={() => setInfoModal('faq')}>FAQ</button>
              <button className="footer-link" onClick={() => setInfoModal('docs')}>API Reference</button>
              <button className="footer-link" onClick={() => setInfoModal('about')}>Status</button>
            </div>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <div className="footer-links">
              <button className="footer-link" onClick={() => setInfoModal('about')}>About Us</button>
              <button className="footer-link" onClick={() => setInfoModal('about')}>Impact</button>
              <button className="footer-link" onClick={() => setInfoModal('privacy')}>Careers</button>
              <button className="footer-link" onClick={() => setInfoModal('docs')}>Newsletter</button>
            </div>
          </div>

          <div className="footer-col">
            <h4>Legal</h4>
            <div className="footer-links">
              <button className="footer-link" onClick={() => setInfoModal('privacy')}>Privacy Policy</button>
              <button className="footer-link" onClick={() => setInfoModal('privacy')}>Terms of Service</button>
              <button className="footer-link" onClick={() => setInfoModal('license')}>License</button>
              <button className="footer-link" onClick={() => setInfoModal('privacy')}>Security</button>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 ImpactLink Architecture. All rights reserved.</p>
          <div className="status-indicator">
            <div className="status-dot" />
            V1.5 FLASH_ENGINE: NOMINAL
          </div>
        </div>
      </footer>

  // Removed inline Auth Modal in favor of /auth route

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
                      openAuthAdmin('signup');
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
    const timer = setInterval(() => setActiveQueue(p => (p + 1) % 5), 3000);
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


function FeatureCard({ icon, title, description }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-description">{description}</p>
    </div>
  );
}
