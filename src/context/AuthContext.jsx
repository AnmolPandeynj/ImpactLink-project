import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (user) {
        try {
          await refreshUser(user);
        } catch (err) {
          console.error("Auth init mapping failed", err);
          setError(err.message);
          setLoading(false);
        }
      } else {
        setAppUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const refreshUser = async (user = firebaseUser) => {
    if (!user) return;
    try {
      setError(null);
      // Force token refresh internally if needed via Firebase, then grab token
      const token = await user.getIdToken();
      // Fetch /api/users/me mapped data
      const HOST = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${HOST}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setAppUser(data);
      } else if (res.status === 404) {
        // Exists in Firebase, but not yet onboarded in Mongo
        // Signal that role needs selection
        setAppUser({ role: null, onboardingComplete: false });
      } else {
        throw new Error('Failed to fetch user context');
      }
    } catch (err) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await auth.signOut();
    setFirebaseUser(null);
    setAppUser(null);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, setAppUser, loading, error, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
