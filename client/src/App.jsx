/**
 * App.jsx
 * Main application component with React Router routes.
 * Refactored to use AuthContext and protected routes.
 */
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import Spline from '@splinetool/react-spline';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Account from './pages/Account';
import OcrPage from './pages/OcrPage';
import AdminDashboard from './pages/AdminDashboard';
import Cart from './pages/Cart';
import LandingPage from './pages/LandingPage';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public auth routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/medicines" element={<ProtectedRoute><Dashboard view="medicines" /></ProtectedRoute>} />
      <Route path="/upload" element={<ProtectedRoute><Dashboard view="upload" /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><Dashboard view="chat" /></ProtectedRoute>} />
      <Route path="/cart" element={<ProtectedRoute><Dashboard view="cart" /></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Redirect authenticated users away from login/signup
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Main Dashboard component (extracted from original App)
function Dashboard({ view: initialView }) {
  const [currentView, setCurrentView] = useState(initialView || 'medicines');
  const [searchTerm, setSearchTerm] = useState('');
  const [medicines, setMedicines] = useState([]);
  const [chatLog, setChatLog] = useState([{ role: 'bot', text: 'Hello! I am your AI health assistant. How can I help you today?' }]);
  const [chatInput, setChatInput] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [addingToCart, setAddingToCart] = useState(null);

  // OCR state
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrPreview, setOcrPreview] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrResult, setOcrResult] = useState(null);

  const { user, token, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Sync view with route
  useEffect(() => {
    if (initialView) {
      setCurrentView(initialView);
    } else if (location.pathname === '/dashboard') {
      setCurrentView('medicines');
    } else if (location.pathname === '/chat') {
      setCurrentView('chat');
    } else if (location.pathname === '/upload') {
      setCurrentView('upload');
    } else if (location.pathname === '/cart') {
      setCurrentView('cart');
    }
  }, [initialView, location.pathname]);

  // --- Medicine Handlers ---
  const fetchMedicines = async () => {
    const url = searchTerm
      ? `${API_BASE}/api/medicines?search=${encodeURIComponent(searchTerm)}`
      : `${API_BASE}/api/medicines`;

    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMedicines(data.medicines || []);
      } else {
        console.error('Failed to fetch medicines:', data.error);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => {
    if (currentView === 'medicines' && token) {
      fetchMedicines();
    }
  }, [currentView, searchTerm, token]);

  // Fetch cart count
  const fetchCartCount = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cart`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const count = data.cart_items?.reduce((sum, item) => sum + item.cart_quantity, 0) || 0;
        setCartCount(count);
      }
    } catch (err) {
      console.error('Failed to fetch cart count:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCartCount();
    }
  }, [token]);

  // Add to cart handler
  const handleAddToCart = async (medicineId, medicineName) => {
    setAddingToCart(medicineId);
    try {
      const res = await fetch(`${API_BASE}/api/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ medicine_id: medicineId, quantity: 1 })
      });

      const data = await res.json();

      if (res.ok) {
        setCartCount(prev => prev + 1);
        // Refresh medicines to get updated stock
        fetchMedicines();
      } else {
        alert(data.error || 'Failed to add to cart');
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    } finally {
      setAddingToCart(null);
    }
  };

  // --- OCR Handlers ---
  const handleOcrFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setOcrFile(selectedFile);
      setOcrPreview(URL.createObjectURL(selectedFile));
      setOcrResult(null);
      setOcrError('');
    }
  };

  const handleOcrUpload = async () => {
    if (!ocrFile) {
      setOcrError('Please select a prescription image');
      return;
    }

    setOcrLoading(true);
    setOcrError('');

    const formData = new FormData();
    formData.append('rx_image', ocrFile);

    try {
      const res = await fetch(`${API_BASE}/api/ocr/scan`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('JSON Parse Error:', text);
        setOcrError('Server returned invalid response. Please try again.');
        setOcrLoading(false);
        return;
      }

      if (res.ok) {
        setOcrResult(data);
      } else {
        setOcrError(data.error || 'Failed to process prescription');
      }
    } catch (err) {
      setOcrError('Network error: ' + err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleOcrClear = () => {
    setOcrFile(null);
    setOcrPreview(null);
    setOcrResult(null);
    setOcrError('');
  };

  const getConfidenceBadgeClass = (confidence) => {
    switch (confidence) {
      case 'high': return 'confidence-high';
      case 'medium': return 'confidence-medium';
      default: return 'confidence-low';
    }
  };

  // --- Chat Handler ---
  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newLog = [...chatLog, { role: 'user', text: chatInput }];
    setChatLog(newLog);
    const msg = chatInput;
    setChatInput('');

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      setChatLog([...newLog, { role: 'bot', text: data.reply }]);
    } catch (err) {
      setChatLog([...newLog, { role: 'bot', text: 'Sorry, something went wrong.' }]);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="logo">
          <i className="fas fa-prescription-bottle-alt"></i>
          PharmaDemo
        </div>
        <div className="nav-links">
          <Link to="/medicines" className={location.pathname === '/' || location.pathname === '/medicines' ? 'active' : ''}>
            <i className="fas fa-pills"></i> Medicines
          </Link>
          <Link to="/upload" className={location.pathname === '/upload' ? 'active' : ''}>
            <i className="fas fa-file-medical-alt"></i> Upload Rx
          </Link>
          <Link to="/chat" className={location.pathname === '/chat' ? 'active' : ''}>
            <i className="fas fa-robot"></i> AI Assistant
          </Link>
          <Link to="/cart" className={`cart-link ${location.pathname === '/cart' ? 'active' : ''}`}>
            <i className="fas fa-shopping-cart"></i> Cart
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>
          {isAdmin && (
            <Link to="/admin" className={location.pathname === '/admin' ? 'active admin-link' : 'admin-link'}>
              <i className="fas fa-cogs"></i> Admin
            </Link>
          )}
          <Link to="/account" className="account-link">
            <i className="fas fa-user-circle"></i>
            {user?.name || user?.email?.split('@')[0] || 'Account'}
          </Link>
          <button className="logout-btn" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>
      </nav>

      <main className="content">
        {currentView === 'medicines' && (
          <div className="medicines-page">
            <div className="page-header">
              <h2>Find Medicines</h2>
              <p style={{ color: '#64748b' }}>Search our extensive database of medicines</p>
            </div>
            <div className="search-bar">
              <input
                placeholder="Search medicines, composition, usage..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="search-btn" onClick={fetchMedicines}>
                <i className="fas fa-search"></i>
              </button>
            </div>
            <div className="medicine-grid">
              {medicines.map(med => (
                <div key={med.medicine_id} className="medicine-card">
                  <div className="card-img-wrapper">
                    {med.image_url ?
                      <img src={med.image_url} alt={med.name} onError={(e) => e.target.style.display = 'none'} />
                      : <i className="fas fa-image placeholder-img"></i>
                    }
                  </div>
                  <div className="card-content">
                    <h3>{med.name}</h3>
                    <span className="badge">{med.composition}</span>
                    <p className="details"><strong>Uses:</strong> {med.uses}</p>
                    <div className="price-row">
                      <span className="price">₹{med.price || 420}</span>
                      <span className="stock-qty">{med.quantity} available</span>
                    </div>
                    <div className="stats">
                      <div className="rating">
                        <i className="fas fa-star"></i> {med.excellent_review_pct}%
                      </div>
                      <span className={`stock-badge ${med.stock_status}`}>
                        {med.stock_status === 'in_stock' ? '✓ In Stock' : '✗ Out of Stock'}
                      </span>
                    </div>
                    <button
                      className="add-to-cart-btn"
                      onClick={() => handleAddToCart(med.medicine_id, med.name)}
                      disabled={addingToCart === med.medicine_id || med.quantity <= 0}
                    >
                      {addingToCart === med.medicine_id ? (
                        <><i className="fas fa-spinner fa-spin"></i> Adding...</>
                      ) : med.quantity <= 0 ? (
                        <><i className="fas fa-times"></i> Out of Stock</>
                      ) : (
                        <><i className="fas fa-cart-plus"></i> Add to Cart</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
              {medicines.length === 0 && (
                <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#64748b' }}>
                  No medicines found. Try a different search term.
                </p>
              )}
            </div>
          </div>
        )}

        {currentView === 'upload' && (
          <div className="ocr-page">
            <div className="ocr-header">
              <h2><i className="fas fa-file-medical-alt"></i> Prescription Scanner</h2>
              <p>Upload a prescription image to extract medicine names and check availability</p>
            </div>

            <div className="ocr-content">
              {/* Upload Section */}
              <div className="upload-section">
                <div className="upload-area">
                  {ocrPreview ? (
                    <div className="preview-container">
                      <img src={ocrPreview} alt="Prescription preview" className="preview-image" />
                      <button className="clear-btn" onClick={handleOcrClear}>
                        <i className="fas fa-times"></i> Clear
                      </button>
                    </div>
                  ) : (
                    <label className="upload-dropzone">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleOcrFileChange}
                        className="file-input"
                      />
                      <i className="fas fa-cloud-upload-alt upload-icon"></i>
                      <h4>Drop prescription image here</h4>
                      <p>or click to browse</p>
                      <span className="file-types">Supports: JPG, PNG, JPEG</span>
                    </label>
                  )}
                </div>

                {ocrFile && !ocrLoading && (
                  <button className="scan-btn" onClick={handleOcrUpload}>
                    <i className="fas fa-search"></i> Scan Prescription
                  </button>
                )}

                {ocrLoading && (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Processing prescription...</p>
                  </div>
                )}

                {ocrError && <div className="error-message">{ocrError}</div>}
              </div>

              {/* Results Section */}
              {ocrResult && (
                <div className="results-section">
                  {/* Raw OCR Text */}
                  <div className="result-card">
                    <h3><i className="fas fa-file-alt"></i> Extracted Text</h3>
                    <div className="raw-text-box">
                      {ocrResult.lines?.map((line, idx) => (
                        <p key={idx}>{line}</p>
                      )) || <p>{ocrResult.raw_text}</p>}
                    </div>
                  </div>

                  {/* Matched Medicines */}
                  {ocrResult.mapped_matches?.length > 0 && (
                    <div className="result-card">
                      <h3><i className="fas fa-pills"></i> Matched Medicines ({ocrResult.mapped_matches.length})</h3>
                      <div className="matches-grid">
                        {ocrResult.mapped_matches.map((match, idx) => (
                          <div key={idx} className={`match-card ${match.available ? 'available' : 'unavailable'}`}>
                            <div className="match-header">
                              <h4>{match.matched_name}</h4>
                              <span className={`confidence-badge ${getConfidenceBadgeClass(match.confidence_label)}`}>
                                {Math.round(match.similarity * 100)}% match
                              </span>
                            </div>
                            <div className="match-details">
                              <span className="token-info">
                                <i className="fas fa-search"></i> Matched: "{match.token}"
                              </span>
                              <div className="availability-row">
                                <span className={`availability-badge ${match.available ? 'in-stock' : 'out-of-stock'}`}>
                                  {match.available ? (
                                    <><i className="fas fa-check-circle"></i> In Stock ({match.quantity})</>
                                  ) : (
                                    <><i className="fas fa-times-circle"></i> Out of Stock</>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inventory Search Results */}
                  {ocrResult.automatic_inventory_search?.by_medicine_name?.length > 0 && (
                    <div className="result-card">
                      <h3><i className="fas fa-database"></i> Found in Inventory</h3>
                      <div className="inventory-list">
                        {ocrResult.automatic_inventory_search.by_medicine_name.map((med, idx) => (
                          <div key={idx} className="inventory-item">
                            <div className="med-info">
                              <h4>{med.name}</h4>
                              <p>{med.uses?.slice(0, 150)}...</p>
                            </div>
                            <span className={`stock-badge ${med.available ? 'in-stock' : 'out-of-stock'}`}>
                              {med.available ? `${med.quantity} in stock` : 'Out of stock'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No matches found */}
                  {(!ocrResult.mapped_matches || ocrResult.mapped_matches.length === 0) && (
                    <div className="result-card no-matches">
                      <i className="fas fa-info-circle"></i>
                      <p>No medicine names could be matched from the prescription text. Try uploading a clearer image.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'chat' && (
          <div className="chat-page-layout">
            <div className="spline-container">
              <Spline scene="https://prod.spline.design/CwNRa7t6K3zjmxH3/scene.splinecode" />
            </div>
            <div className="chat-container">
              <div className="chat-header">
                <i className="fas fa-user-md"></i>
                <div>
                  <h2>Dr. Bot</h2>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Always online</span>
                </div>
              </div>

              <div className="chat-messages">
                {chatLog.map((msg, idx) => (
                  <div key={idx} className={`message-bubble ${msg.role}`}>
                    {msg.text}
                  </div>
                ))}
              </div>

              <form onSubmit={handleChat} className="chat-input-wrapper">
                <div className="input-row">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Type your symptoms or questions..."
                  />
                  <button type="submit" className="send-btn">
                    <i className="fas fa-paper-plane"></i>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {currentView === 'cart' && (
          <Cart onCartUpdate={fetchCartCount} />
        )}
      </main>
    </div>
  );
}

export default App;
