/**
 * AdminDashboard.jsx
 * Admin inventory management with CRUD operations and quantity controls.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { API_BASE } from '../config/api';
import './AdminDashboard.css';

export default function AdminDashboard() {
    const { token, isAdmin } = useAuth();
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMedicine, setNewMedicine] = useState({
        name: '', composition: '', uses: '', side_effects: '', manufacturer: '', quantity: 67, price: 420
    });

    // Redirect non-admin users
    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    const fetchMedicines = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/medicines`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setMedicines(data.medicines || []);
            } else {
                setError(data.error || 'Failed to fetch medicines');
            }
        } catch (err) {
            setError('Network error: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchMedicines();
    }, [fetchMedicines]);

    const handleAdjustQuantity = async (id, delta) => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/medicines/${id}/adjust-quantity`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ delta })
            });
            const data = await res.json();
            if (res.ok) {
                setMedicines(meds => meds.map(m => m.medicine_id === id ? data.medicine : m));
            } else {
                alert(data.error || 'Failed to adjust quantity');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const handleAdjustPrice = async (id, delta) => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/medicines/${id}/adjust-price`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ delta })
            });
            const data = await res.json();
            if (res.ok) {
                setMedicines(meds => meds.map(m => m.medicine_id === id ? data.medicine : m));
            } else {
                alert(data.error || 'Failed to adjust price');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const handleStartEdit = (med) => {
        setEditingId(med.medicine_id);
        setEditForm({
            name: med.name,
            composition: med.composition,
            uses: med.uses,
            side_effects: med.side_effects,
            manufacturer: med.manufacturer,
            quantity: med.quantity,
            price: med.price || 420
        });
    };

    const handleSaveEdit = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/medicines/${editingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editForm)
            });
            const data = await res.json();
            if (res.ok) {
                setMedicines(meds => meds.map(m => m.medicine_id === editingId ? data.medicine : m));
                setEditingId(null);
            } else {
                alert(data.error || 'Failed to update medicine');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this medicine?')) return;

        try {
            const res = await fetch(`${API_BASE}/api/admin/medicines/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setMedicines(meds => meds.filter(m => m.medicine_id !== id));
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete medicine');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const handleAddMedicine = async () => {
        if (!newMedicine.name.trim()) {
            alert('Medicine name is required');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/admin/medicines`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newMedicine)
            });
            const data = await res.json();
            if (res.ok) {
                setMedicines([data.medicine, ...medicines]);
                setShowAddModal(false);
                setNewMedicine({ name: '', composition: '', uses: '', side_effects: '', manufacturer: '', quantity: 67, price: 420 });
            } else {
                alert(data.error || 'Failed to add medicine');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const filteredMedicines = medicines.filter(med =>
        med.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.composition?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="spinner"></div>
                <p>Loading inventory...</p>
            </div>
        );
    }

    return (
        <div className="admin-dashboard">
            <div className="admin-header">
                <div className="header-left">
                    <h2><i className="fas fa-cogs"></i> Admin Dashboard</h2>
                    <p>Manage medicine inventory</p>
                </div>
                <button className="add-btn" onClick={() => setShowAddModal(true)}>
                    <i className="fas fa-plus"></i> Add Medicine
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="admin-controls">
                <div className="search-box">
                    <i className="fas fa-search"></i>
                    <input
                        type="text"
                        placeholder="Search medicines..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="stats">
                    <span className="stat">
                        <i className="fas fa-pills"></i> {medicines.length} total
                    </span>
                    <span className="stat in-stock">
                        <i className="fas fa-check"></i> {medicines.filter(m => m.quantity > 0).length} in stock
                    </span>
                    <span className="stat out-of-stock">
                        <i className="fas fa-times"></i> {medicines.filter(m => m.quantity === 0).length} out of stock
                    </span>
                </div>
            </div>

            <div className="medicines-table-wrapper">
                <table className="medicines-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Composition</th>
                            <th>Uses</th>
                            <th>Price (₹)</th>
                            <th>Quantity</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredMedicines.slice(0, 100).map(med => (
                            <tr key={med.medicine_id} className={med.quantity === 0 ? 'out-of-stock-row' : ''}>
                                {editingId === med.medicine_id ? (
                                    <>
                                        <td>
                                            <input
                                                value={editForm.name}
                                                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                value={editForm.composition}
                                                onChange={(e) => setEditForm({...editForm, composition: e.target.value})}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                value={editForm.uses}
                                                onChange={(e) => setEditForm({...editForm, uses: e.target.value})}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={editForm.price}
                                                onChange={(e) => setEditForm({...editForm, price: parseFloat(e.target.value) || 0})}
                                                min="0"
                                                step="0.01"
                                                className="price-input"
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={editForm.quantity}
                                                onChange={(e) => setEditForm({...editForm, quantity: parseInt(e.target.value) || 0})}
                                                min="0"
                                            />
                                        </td>
                                        <td>
                                            <span className={`status-badge ${editForm.quantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
                                                {editForm.quantity > 0 ? 'In Stock' : 'Out of Stock'}
                                            </span>
                                        </td>
                                        <td className="actions-cell">
                                            <button className="save-btn" onClick={handleSaveEdit}>
                                                <i className="fas fa-check"></i>
                                            </button>
                                            <button className="cancel-btn" onClick={() => setEditingId(null)}>
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="name-cell">{med.name}</td>
                                        <td className="comp-cell" title={med.composition}>
                                            {med.composition?.slice(0, 50)}{med.composition?.length > 50 ? '...' : ''}
                                        </td>
                                        <td className="uses-cell" title={med.uses}>
                                            {med.uses?.slice(0, 60)}{med.uses?.length > 60 ? '...' : ''}
                                        </td>
                                        <td className="price-cell">
                                            <div className="price-controls">
                                                <button onClick={() => handleAdjustPrice(med.medicine_id, -10)} disabled={(med.price || 420) <= 10}>
                                                    <i className="fas fa-minus"></i>
                                                </button>
                                                <span className="price-value">₹{med.price || 420}</span>
                                                <button onClick={() => handleAdjustPrice(med.medicine_id, 10)}>
                                                    <i className="fas fa-plus"></i>
                                                </button>
                                            </div>
                                        </td>
                                        <td className="quantity-cell">
                                            <div className="quantity-controls">
                                                <button onClick={() => handleAdjustQuantity(med.medicine_id, -1)} disabled={med.quantity === 0}>
                                                    <i className="fas fa-minus"></i>
                                                </button>
                                                <span className="qty-value">{med.quantity}</span>
                                                <button onClick={() => handleAdjustQuantity(med.medicine_id, 1)}>
                                                    <i className="fas fa-plus"></i>
                                                </button>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${med.quantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
                                                {med.quantity > 0 ? 'In Stock' : 'Out of Stock'}
                                            </span>
                                        </td>
                                        <td className="actions-cell">
                                            <button className="edit-btn" onClick={() => handleStartEdit(med)}>
                                                <i className="fas fa-edit"></i>
                                            </button>
                                            <button className="delete-btn" onClick={() => handleDelete(med.medicine_id)}>
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredMedicines.length > 100 && (
                    <p className="table-note">Showing first 100 of {filteredMedicines.length} results</p>
                )}
            </div>

            {/* Add Medicine Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Add New Medicine</h3>
                        <div className="modal-form">
                            <div className="form-group">
                                <label>Name *</label>
                                <input
                                    value={newMedicine.name}
                                    onChange={(e) => setNewMedicine({...newMedicine, name: e.target.value})}
                                    placeholder="Medicine name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Composition</label>
                                <input
                                    value={newMedicine.composition}
                                    onChange={(e) => setNewMedicine({...newMedicine, composition: e.target.value})}
                                    placeholder="Active ingredients"
                                />
                            </div>
                            <div className="form-group">
                                <label>Uses</label>
                                <textarea
                                    value={newMedicine.uses}
                                    onChange={(e) => setNewMedicine({...newMedicine, uses: e.target.value})}
                                    placeholder="What is this medicine used for?"
                                    rows={3}
                                />
                            </div>
                            <div className="form-group">
                                <label>Side Effects</label>
                                <textarea
                                    value={newMedicine.side_effects}
                                    onChange={(e) => setNewMedicine({...newMedicine, side_effects: e.target.value})}
                                    placeholder="Possible side effects"
                                    rows={2}
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Manufacturer</label>
                                    <input
                                        value={newMedicine.manufacturer}
                                        onChange={(e) => setNewMedicine({...newMedicine, manufacturer: e.target.value})}
                                        placeholder="Manufacturer name"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Price (₹)</label>
                                    <input
                                        type="number"
                                        value={newMedicine.price}
                                        onChange={(e) => setNewMedicine({...newMedicine, price: parseFloat(e.target.value) || 0})}
                                        min="0"
                                        step="0.01"
                                        placeholder="420"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Quantity</label>
                                    <input
                                        type="number"
                                        value={newMedicine.quantity}
                                        onChange={(e) => setNewMedicine({...newMedicine, quantity: parseInt(e.target.value) || 0})}
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="save-btn" onClick={handleAddMedicine}>Add Medicine</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
