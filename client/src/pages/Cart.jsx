/**
 * Cart.jsx
 * Shopping cart with checkout and bill generation
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './Cart.css';

const API_BASE = 'http://localhost:3000';

export default function Cart({ onCartUpdate }) {
    const { token, user } = useAuth();
    const [cartItems, setCartItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [checkingOut, setCheckingOut] = useState(false);
    const [orderComplete, setOrderComplete] = useState(null);

    const fetchCart = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/cart`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setCartItems(data.cart_items || []);
                setTotal(data.total || 0);
                if (onCartUpdate) onCartUpdate();
            } else {
                setError(data.error || 'Failed to fetch cart');
            }
        } catch (err) {
            setError('Network error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCart();
    }, [token]);

    const updateQuantity = async (cartItemId, newQuantity) => {
        if (newQuantity < 1) return;
        
        try {
            const res = await fetch(`${API_BASE}/api/cart/${cartItemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ quantity: newQuantity })
            });
            const data = await res.json();
            if (res.ok) {
                fetchCart();
            } else {
                alert(data.error || 'Failed to update quantity');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const removeItem = async (cartItemId) => {
        try {
            const res = await fetch(`${API_BASE}/api/cart/${cartItemId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchCart();
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const handleCheckout = async () => {
        if (cartItems.length === 0) return;
        
        setCheckingOut(true);
        setError('');
        
        try {
            const res = await fetch(`${API_BASE}/api/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            
            if (res.ok) {
                setOrderComplete(data.order);
                setCartItems([]);
                setTotal(0);
                if (onCartUpdate) onCartUpdate();
            } else {
                setError(data.error || 'Checkout failed');
            }
        } catch (err) {
            setError('Network error: ' + err.message);
        } finally {
            setCheckingOut(false);
        }
    };

    const printBill = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="cart-page">
                <div className="cart-loading">
                    <div className="spinner"></div>
                    <p>Loading cart...</p>
                </div>
            </div>
        );
    }

    // Show bill/receipt after checkout
    if (orderComplete) {
        return (
            <div className="cart-page">
                <div className="bill-container" id="printable-bill">
                    <div className="bill-header">
                        <div className="bill-logo">
                            <i className="fas fa-prescription-bottle-alt"></i>
                            <h1>PharmaDemo</h1>
                        </div>
                        <div className="bill-title">
                            <h2>Invoice / Bill</h2>
                            <p>Order #{orderComplete.order_id}</p>
                        </div>
                    </div>

                    <div className="bill-customer">
                        <div className="customer-avatar">
                            {orderComplete.user?.avatar_url ? (
                                <img src={`${API_BASE}${orderComplete.user.avatar_url}`} alt="Customer" />
                            ) : (
                                <i className="fas fa-user-circle"></i>
                            )}
                        </div>
                        <div className="customer-details">
                            <h3>{orderComplete.user?.name || 'Customer'}</h3>
                            <p><i className="fas fa-envelope"></i> {orderComplete.user?.email}</p>
                            <p><i className="fas fa-calendar"></i> {new Date(orderComplete.created_at).toLocaleString()}</p>
                        </div>
                    </div>

                    <table className="bill-items">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Medicine</th>
                                <th>Qty</th>
                                <th>Price</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orderComplete.items.map((item, idx) => (
                                <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td>{item.name}</td>
                                    <td>{item.quantity}</td>
                                    <td>₹{item.price.toFixed(2)}</td>
                                    <td>₹{item.subtotal.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="total-row">
                                <td colSpan="4">Total Amount</td>
                                <td>₹{orderComplete.total_amount.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="bill-footer">
                        <p>Thank you for shopping with PharmaDemo!</p>
                        <p className="small">This is a computer-generated invoice.</p>
                    </div>

                    <div className="bill-actions no-print">
                        <button className="print-btn" onClick={printBill}>
                            <i className="fas fa-print"></i> Print Bill
                        </button>
                        <Link to="/medicines" className="continue-btn">
                            <i className="fas fa-shopping-bag"></i> Continue Shopping
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="cart-page">
            <div className="cart-header">
                <h2><i className="fas fa-shopping-cart"></i> Your Cart</h2>
                <p>{cartItems.length} item(s) in cart</p>
            </div>

            {error && <div className="error-message">{error}</div>}

            {cartItems.length === 0 ? (
                <div className="empty-cart">
                    <i className="fas fa-shopping-basket"></i>
                    <h3>Your cart is empty</h3>
                    <p>Browse our medicines and add items to your cart</p>
                    <Link to="/medicines" className="shop-btn">
                        <i className="fas fa-pills"></i> Browse Medicines
                    </Link>
                </div>
            ) : (
                <div className="cart-content">
                    <div className="cart-items">
                        {cartItems.map(item => (
                            <div key={item.cart_item_id} className="cart-item">
                                <div className="item-image">
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.name} onError={(e) => e.target.style.display = 'none'} />
                                    ) : (
                                        <i className="fas fa-pills"></i>
                                    )}
                                </div>
                                <div className="item-details">
                                    <h4>{item.name}</h4>
                                    <p className="composition">{item.composition?.slice(0, 60)}...</p>
                                    <p className="price">₹{item.price.toFixed(2)}</p>
                                    <p className="stock-info">
                                        {item.stock_quantity > 0 ? (
                                            <span className="in-stock">{item.stock_quantity} in stock</span>
                                        ) : (
                                            <span className="out-of-stock">Out of stock</span>
                                        )}
                                    </p>
                                </div>
                                <div className="item-quantity">
                                    <button 
                                        onClick={() => updateQuantity(item.cart_item_id, item.cart_quantity - 1)}
                                        disabled={item.cart_quantity <= 1}
                                    >
                                        <i className="fas fa-minus"></i>
                                    </button>
                                    <span>{item.cart_quantity}</span>
                                    <button 
                                        onClick={() => updateQuantity(item.cart_item_id, item.cart_quantity + 1)}
                                        disabled={item.cart_quantity >= item.stock_quantity}
                                    >
                                        <i className="fas fa-plus"></i>
                                    </button>
                                </div>
                                <div className="item-subtotal">
                                    <p>₹{(item.price * item.cart_quantity).toFixed(2)}</p>
                                </div>
                                <button className="remove-btn" onClick={() => removeItem(item.cart_item_id)}>
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="cart-summary">
                        <h3>Order Summary</h3>
                        <div className="summary-row">
                            <span>Subtotal ({cartItems.length} items)</span>
                            <span>₹{total.toFixed(2)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Delivery</span>
                            <span className="free">FREE</span>
                        </div>
                        <div className="summary-row total">
                            <span>Total</span>
                            <span>₹{total.toFixed(2)}</span>
                        </div>
                        <button 
                            className="checkout-btn" 
                            onClick={handleCheckout}
                            disabled={checkingOut || cartItems.length === 0}
                        >
                            {checkingOut ? (
                                <><i className="fas fa-spinner fa-spin"></i> Processing...</>
                            ) : (
                                <><i className="fas fa-credit-card"></i> Checkout</>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
