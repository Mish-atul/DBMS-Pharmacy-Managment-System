/**
 * OcrPage.jsx
 * Enhanced OCR page with prescription upload, raw text display,
 * matched medicines with confidence badges, and availability status.
 */
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './OcrPage.css';

const API_BASE = 'http://localhost:3000';

export default function OcrPage() {
    const { token } = useAuth();
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
            setResult(null);
            setError('');
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a prescription image');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('rx_image', file);

        try {
            const res = await fetch(`${API_BASE}/api/ocr/scan`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                setResult(data);
            } else {
                setError(data.error || 'Failed to process prescription');
            }
        } catch (err) {
            setError('Network error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setFile(null);
        setPreview(null);
        setResult(null);
        setError('');
    };

    const getConfidenceBadgeClass = (confidence) => {
        switch (confidence) {
            case 'high': return 'confidence-high';
            case 'medium': return 'confidence-medium';
            default: return 'confidence-low';
        }
    };

    return (
        <div className="ocr-page">
            <div className="ocr-header">
                <h2><i className="fas fa-file-medical-alt"></i> Prescription Scanner</h2>
                <p>Upload a prescription image to extract medicine names and check availability</p>
            </div>

            <div className="ocr-content">
                {/* Upload Section */}
                <div className="upload-section">
                    <div className="upload-area">
                        {preview ? (
                            <div className="preview-container">
                                <img src={preview} alt="Prescription preview" className="preview-image" />
                                <button className="clear-btn" onClick={handleClear}>
                                    <i className="fas fa-times"></i> Clear
                                </button>
                            </div>
                        ) : (
                            <label className="upload-dropzone">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="file-input"
                                />
                                <i className="fas fa-cloud-upload-alt upload-icon"></i>
                                <h4>Drop prescription image here</h4>
                                <p>or click to browse</p>
                                <span className="file-types">Supports: JPG, PNG, JPEG</span>
                            </label>
                        )}
                    </div>

                    {file && !loading && (
                        <button className="scan-btn" onClick={handleUpload}>
                            <i className="fas fa-search"></i> Scan Prescription
                        </button>
                    )}

                    {loading && (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Processing prescription...</p>
                        </div>
                    )}

                    {error && <div className="error-message">{error}</div>}
                </div>

                {/* Results Section */}
                {result && (
                    <div className="results-section">
                        {/* Raw OCR Text */}
                        <div className="result-card">
                            <h3><i className="fas fa-file-alt"></i> Extracted Text</h3>
                            <div className="raw-text-box">
                                {result.lines?.map((line, idx) => (
                                    <p key={idx}>{line}</p>
                                )) || <p>{result.raw_text}</p>}
                            </div>
                        </div>

                        {/* Matched Medicines */}
                        {result.mapped_matches?.length > 0 && (
                            <div className="result-card">
                                <h3><i className="fas fa-pills"></i> Matched Medicines ({result.mapped_matches.length})</h3>
                                <div className="matches-grid">
                                    {result.mapped_matches.map((match, idx) => (
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
                        {result.automatic_inventory_search?.by_medicine_name?.length > 0 && (
                            <div className="result-card">
                                <h3><i className="fas fa-database"></i> Found in Inventory</h3>
                                <div className="inventory-list">
                                    {result.automatic_inventory_search.by_medicine_name.map((med, idx) => (
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

                        {/* Symptom-based suggestions */}
                        {result.automatic_inventory_search?.by_symptoms?.length > 0 && (
                            <div className="result-card">
                                <h3><i className="fas fa-stethoscope"></i> Related Medicines (by symptoms)</h3>
                                <div className="inventory-list">
                                    {result.automatic_inventory_search.by_symptoms.slice(0, 5).map((med, idx) => (
                                        <div key={idx} className="inventory-item">
                                            <div className="med-info">
                                                <h4>{med.name}</h4>
                                                <p>{med.composition}</p>
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
                        {(!result.mapped_matches || result.mapped_matches.length === 0) && (
                            <div className="result-card no-matches">
                                <i className="fas fa-info-circle"></i>
                                <p>No medicine names could be matched from the prescription text. Try uploading a clearer image.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
