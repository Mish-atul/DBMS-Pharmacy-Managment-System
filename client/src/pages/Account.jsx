/**
 * Account.jsx
 * User profile page with editable name, age, health problems, and avatar upload.
 */
import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import './Account.css';

export default function Account() {
    const { user, updateProfile, uploadAvatar, logout } = useAuth();
    
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(user?.name || '');
    const [age, setAge] = useState(user?.age || '');
    const [healthProblems, setHealthProblems] = useState(user?.health_problems || '');
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const fileInputRef = useRef(null);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setMessage('');

        try {
            await updateProfile({ name, age: age ? parseInt(age) : null, health_problems: healthProblems });
            setMessage('Profile updated successfully!');
            setEditing(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type and size
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB');
            return;
        }

        setUploadingAvatar(true);
        setError('');
        setMessage('');

        try {
            await uploadAvatar(file);
            setMessage('Avatar updated successfully!');
        } catch (err) {
            setError(err.message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleCancel = () => {
        setName(user?.name || '');
        setAge(user?.age || '');
        setHealthProblems(user?.health_problems || '');
        setEditing(false);
        setError('');
        setMessage('');
    };

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const avatarUrl = user?.avatar_url 
        ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${API_BASE}${user.avatar_url}`)
        : null;

    return (
        <div className="account-page">
            <div className="account-card">
                <div className="account-header">
                    <div className="avatar-section" onClick={handleAvatarClick}>
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="avatar-img" />
                        ) : (
                            <div className="avatar-placeholder">
                                <i className="fas fa-user"></i>
                            </div>
                        )}
                        <div className="avatar-overlay">
                            <i className="fas fa-camera"></i>
                            {uploadingAvatar && <span>Uploading...</span>}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            style={{ display: 'none' }}
                        />
                    </div>
                    <div className="user-info">
                        <h2>{user?.name || user?.username || user?.email}</h2>
                        <p className="email">{user?.email}</p>
                        {user?.has_google && (
                            <span className="google-badge">
                                <i className="fab fa-google"></i> Google Account
                            </span>
                        )}
                        {user?.role === 'admin' && (
                            <span className="admin-badge">
                                <i className="fas fa-shield-alt"></i> Admin
                            </span>
                        )}
                    </div>
                </div>

                {message && <div className="success-message">{message}</div>}
                {error && <div className="error-message">{error}</div>}

                <div className="account-body">
                    <h3>Profile Information</h3>

                    <div className="form-group">
                        <label>Display Name</label>
                        {editing ? (
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your name"
                            />
                        ) : (
                            <p className="field-value">{user?.name || 'Not set'}</p>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Age</label>
                        {editing ? (
                            <input
                                type="number"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                placeholder="Enter your age"
                                min="1"
                                max="150"
                            />
                        ) : (
                            <p className="field-value">{user?.age || 'Not set'}</p>
                        )}
                    </div>

                    <div className="form-group">
                        <label>Health Conditions / Allergies</label>
                        {editing ? (
                            <textarea
                                value={healthProblems}
                                onChange={(e) => setHealthProblems(e.target.value)}
                                placeholder="List any health conditions, allergies, or medications you're currently taking..."
                                rows={4}
                            />
                        ) : (
                            <p className="field-value health-text">
                                {user?.health_problems || 'Not set'}
                            </p>
                        )}
                    </div>

                    <div className="account-actions">
                        {editing ? (
                            <>
                                <button className="save-btn" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button className="cancel-btn" onClick={handleCancel} disabled={saving}>
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button className="edit-btn" onClick={() => setEditing(true)}>
                                <i className="fas fa-edit"></i> Edit Profile
                            </button>
                        )}
                    </div>
                </div>

                <div className="account-footer">
                    <p className="member-since">
                        Member since: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                    </p>
                    <button className="logout-btn" onClick={logout}>
                        <i className="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
