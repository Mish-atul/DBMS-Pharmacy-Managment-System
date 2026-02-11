/**
 * LandingPage.jsx
 * Premium scrollytelling landing page for PharmaDemo.
 * Canvas-based image sequence animation + Framer Motion scroll reveals.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import './LandingPage.css';

const TOTAL_FRAMES = 192;

/* ── Canvas component that draws frames as full-screen background ── */
function ScrollCanvas({ sectionRef }) {
    const canvasRef = useRef(null);
    const imagesRef = useRef(new Array(TOTAL_FRAMES).fill(null));
    const frameIndexRef = useRef(0);
    const rafRef = useRef(null);

    // Draw a frame scaled to cover the full canvas (like object-fit: cover)
    const drawFrame = useCallback((index) => {
        const canvas = canvasRef.current;
        const img = imagesRef.current[index];
        if (!canvas || !img) return;

        const ctx = canvas.getContext('2d');
        const cw = canvas.width;
        const ch = canvas.height;
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;

        // Cover algorithm: scale to fill, then center-crop
        const scale = Math.max(cw / iw, ch / ih);
        const sw = iw * scale;
        const sh = ih * scale;
        const sx = (cw - sw) / 2;
        const sy = (ch - sh) / 2;

        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(img, sx, sy, sw, sh);
    }, []);

    // Set canvas buffer size to match viewport
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            // Redraw current frame after resize
            drawFrame(frameIndexRef.current);
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [drawFrame]);

    // Load ALL images eagerly into a ref
    useEffect(() => {
        for (let i = 0; i < TOTAL_FRAMES; i++) {
            const img = new Image();
            const idx = String(i + 1).padStart(3, '0');
            img.src = `/frames/ezgif-frame-${idx}.jpg`;
            img.onload = () => {
                imagesRef.current[i] = img;
                // Draw first frame immediately
                if (i === 0) drawFrame(0);
            };
        }
    }, [drawFrame]);

    // Scroll-driven frame rendering
    useEffect(() => {
        const handleScroll = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                const section = sectionRef.current;
                if (!section) return;

                const rect = section.getBoundingClientRect();
                const sectionTop = -rect.top;
                const sectionHeight = section.offsetHeight - window.innerHeight;
                const progress = Math.max(0, Math.min(1, sectionTop / sectionHeight));
                const index = Math.min(TOTAL_FRAMES - 1, Math.floor(progress * TOTAL_FRAMES));

                if (index !== frameIndexRef.current) {
                    frameIndexRef.current = index;
                    drawFrame(index);
                }
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [sectionRef, drawFrame]);

    return <canvas ref={canvasRef} className="scroll-canvas" />;
}

/* ── Text overlay triggered by scroll progress ── */
function TextOverlay({ scrollYProgress, startAt, endAt, side, icon, iconClass, title, description }) {
    const opacity = useTransform(
        scrollYProgress,
        [startAt, startAt + 0.04, endAt - 0.04, endAt],
        [0, 1, 1, 0]
    );
    const y = useTransform(
        scrollYProgress,
        [startAt, startAt + 0.04, endAt - 0.04, endAt],
        [40, 0, 0, -40]
    );

    return (
        <motion.div className="text-overlay" style={{ opacity }}>
            <motion.div className={`overlay-content ${side}`} style={{ y }}>
                <div className={`overlay-icon ${iconClass}`}>
                    <i className={icon}></i>
                </div>
                <h3 className="overlay-title">{title}</h3>
                <p className="overlay-desc">{description}</p>
            </motion.div>
        </motion.div>
    );
}

/* ── Floating particles ── */
function Particles() {
    const types = ['capsule', 'dot', 'tablet', 'dot', 'capsule', 'tablet', 'dot', 'capsule', 'dot', 'tablet', 'capsule', 'dot', 'tablet', 'capsule', 'dot'];
    return (
        <div className="particles-container">
            {types.map((type, i) => (
                <div key={i} className={`particle ${type}`} />
            ))}
        </div>
    );
}

/* ── Feature card data ── */
const features = [
    {
        icon: 'fas fa-camera',
        iconBg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
        iconColor: '#0284c7',
        title: 'Prescription OCR',
        desc: 'Upload a prescription image and our OCR engine extracts medicine names instantly with high accuracy.'
    },
    {
        icon: 'fas fa-brain',
        iconBg: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
        iconColor: '#6366f1',
        title: 'Fuzzy Matching',
        desc: 'Advanced similarity algorithms match extracted text to our medicine database — even with typos or abbreviations.'
    },
    {
        icon: 'fas fa-chart-line',
        iconBg: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
        iconColor: '#16a34a',
        title: 'Live Inventory',
        desc: 'Real-time stock availability checks across the entire pharmacy inventory with instant results.'
    },
    {
        icon: 'fas fa-shield-alt',
        iconBg: 'linear-gradient(135deg, #fef3c7, #fde68a)',
        iconColor: '#d97706',
        title: 'Admin Dashboard',
        desc: 'Role-based access with an admin panel for managing stock quantities, adding medicines, and controlling inventory.'
    },
    {
        icon: 'fas fa-shopping-cart',
        iconBg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
        iconColor: '#db2777',
        title: 'Cart & Orders',
        desc: 'Seamless add-to-cart workflow with quantity validation against live stock — no overselling.'
    },
    {
        icon: 'fas fa-robot',
        iconBg: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
        iconColor: '#0ea5e9',
        title: 'AI Health Assistant',
        desc: 'Chat with our AI bot for quick health queries, medicine info, and symptom guidance.'
    }
];

/* ── Main Landing Page ── */
export default function LandingPage() {
    const scrollSectionRef = useRef(null);
    const [navScrolled, setNavScrolled] = useState(false);

    const { scrollYProgress } = useScroll({
        target: scrollSectionRef,
        offset: ['start start', 'end end']
    });

    useEffect(() => {
        const handleScroll = () => setNavScrolled(window.scrollY > 60);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="landing-page">
            <Particles />

            {/* ── Navbar ── */}
            <nav className={`landing-navbar ${navScrolled ? 'scrolled' : ''}`}>
                <Link to="/" className="landing-nav-brand">
                    <span className="brand-icon">
                        <i className="fas fa-capsules"></i>
                    </span>
                    <span className="brand-name">PharmaDemo</span>
                </Link>
                <div className="landing-nav-links">
                    <a href="#features">Features</a>
                    <Link to="/login">Sign In</Link>
                    <Link to="/upload" className="cta-glow">
                        <i className="fas fa-microscope"></i> Try OCR Demo
                    </Link>
                </div>
            </nav>

            {/* ── Hero Section ── */}
            <section className="landing-hero">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                >
                    <span className="hero-badge">
                        <i className="fas fa-circle" style={{ color: '#10b981', fontSize: '6px' }}></i>
                        Next-Gen Pharmacy Platform
                    </span>
                </motion.div>

                <motion.h1
                    className="hero-title"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
                >
                    Pharmacy Intelligence,<br />
                    <span className="gradient-text">Reimagined</span>
                </motion.h1>

                <motion.p
                    className="hero-subtitle"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.35, ease: 'easeOut' }}
                >
                    Scan prescriptions with OCR, match medicines with fuzzy algorithms,
                    and manage inventory in real-time — all from one unified dashboard.
                </motion.p>

                <motion.div
                    className="hero-actions"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.55, ease: 'easeOut' }}
                >
                    <Link to="/login" className="hero-btn-primary">
                        Get Started <i className="fas fa-arrow-right"></i>
                    </Link>
                    <a href="#features" className="hero-btn-secondary">
                        <i className="fas fa-play"></i> See How It Works
                    </a>
                </motion.div>

                <div className="scroll-indicator">
                    <span>Scroll to explore</span>
                    <i className="fas fa-chevron-down"></i>
                </div>
            </section>

            {/* ── Scroll Canvas + Text Overlays ── */}
            <section className="scroll-canvas-section" ref={scrollSectionRef}>
                <div className="canvas-sticky-wrapper">
                    <ScrollCanvas sectionRef={scrollSectionRef} />

                    {/* Overlay 1: 0–25% */}
                    <TextOverlay
                        scrollYProgress={scrollYProgress}
                        startAt={0.02} endAt={0.22}
                        side="left"
                        icon="fas fa-qrcode" iconClass="blue"
                        title="Scan Prescriptions Instantly"
                        description="Upload any handwritten or printed prescription. Our OCR engine reads it in seconds and extracts every medicine name with pinpoint accuracy."
                    />

                    {/* Overlay 2: 25–50% */}
                    <TextOverlay
                        scrollYProgress={scrollYProgress}
                        startAt={0.26} endAt={0.46}
                        side="right"
                        icon="fas fa-brain" iconClass="purple"
                        title="OCR + Fuzzy Medicine Matching"
                        description="Intelligent text similarity algorithms match extracted names against your database — handling typos, abbreviations, and brand variants automatically."
                    />

                    {/* Overlay 3: 50–75% */}
                    <TextOverlay
                        scrollYProgress={scrollYProgress}
                        startAt={0.50} endAt={0.70}
                        side="left"
                        icon="fas fa-chart-bar" iconClass="green"
                        title="Real-Time Inventory Availability"
                        description="Instantly check stock levels across your entire pharmacy. Every search and scan automatically verifies medicine availability in real-time."
                    />

                    {/* Overlay 4: 75–100% */}
                    <TextOverlay
                        scrollYProgress={scrollYProgress}
                        startAt={0.74} endAt={0.94}
                        side="right"
                        icon="fas fa-sliders-h" iconClass="amber"
                        title="Admin Controlled Stock Dashboard"
                        description="Full admin access to manage medicine quantities, add new items, and maintain inventory control — all from a secure dashboard."
                    />
                </div>
            </section>

            {/* ── Features Grid ── */}
            <section className="landing-features" id="features">
                <div className="features-header">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.5 }}
                        transition={{ duration: 0.6 }}
                    >
                        Everything You Need
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.5 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                    >
                        A complete pharmacy management platform — from prescription scanning to stock control.
                    </motion.p>
                </div>
                <div className="features-grid">
                    {features.map((f, i) => (
                        <motion.div
                            key={i}
                            className="feature-card"
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.3 }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                        >
                            <div className="feature-card-icon" style={{ background: f.iconBg, color: f.iconColor }}>
                                <i className={f.icon}></i>
                            </div>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── CTA Section ── */}
            <section className="landing-cta-section">
                <motion.div
                    className="cta-container"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.7 }}
                >
                    <h2>Ready to Transform Your Pharmacy?</h2>
                    <p>
                        Join PharmaDemo and experience next-generation prescription scanning,
                        intelligent medicine matching, and real-time inventory management.
                    </p>
                    <div className="cta-buttons">
                        <Link to="/signup" className="hero-btn-primary">
                            Create Free Account <i className="fas fa-arrow-right"></i>
                        </Link>
                        <Link to="/login" className="hero-btn-secondary">Sign In</Link>
                    </div>
                </motion.div>
            </section>

            {/* ── Footer ── */}
            <footer className="landing-footer">
                <p>© 2026 <span className="footer-brand">PharmaDemo</span>. Built for DBMS Lab.</p>
            </footer>
        </div>
    );
}
