// firebase.js – Firebase Auth + Firestore Leaderboard

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCBS9kZCitvpeAMmnBY0I2aLwqcRHn8IFA",
  authDomain: "rutger-webapp.firebaseapp.com",
  projectId: "rutger-webapp",
  storageBucket: "rutger-webapp.firebasestorage.app",
  messagingSenderId: "871465688723",
  appId: "1:871465688723:web:536a6e11e4687275497766",
  measurementId: "G-Q9HB6B4TTT"
};

let auth = null;
let db = null;
let currentUid = null;

// Auth-Ready Promise – resolved sobald UID bekannt
let _resolveAuth;
const authReady = new Promise(r => { _resolveAuth = r; });

// ── Init (einmal beim Boot aufrufen) ─────────────────────────────────────────
export function initFirebase() {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, user => {
    if (user) {
      currentUid = user.uid;
      _resolveAuth(currentUid);
    } else {
      signInAnonymously(auth).catch(err => console.warn('Anonymous auth failed:', err));
    }
  });
}

// ── UID holen (wartet bis Auth fertig) ───────────────────────────────────────
export function getUid() {
  return authReady;
}

// ── Username ─────────────────────────────────────────────────────────────────
export function getUsername() {
  return localStorage.getItem('htrj_username');
}

export async function setUsername(name) {
  localStorage.setItem('htrj_username', name);
  const uid = await getUid();
  const ref = doc(db, 'leaderboard', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await setDoc(ref, { name }, { merge: true });
  } else {
    await setDoc(ref, { name, score: 0, updatedAt: serverTimestamp() });
  }
}

// ── Namen aus eigenem Eintrag holen (Prompt-Prefill nach verlorenem localStorage) ─
export async function fetchOwnName() {
  try {
    const uid = await getUid();
    const snap = await getDoc(doc(db, 'leaderboard', uid));
    return snap.exists() ? (snap.data().name || null) : null;
  } catch (err) {
    console.warn('Name recovery failed:', err);
    return null;
  }
}

// ── Score submitten (nur wenn höher als bisheriger) ──────────────────────────
export async function submitScore(score) {
  try {
    const uid = await getUid();
    const name = getUsername();
    if (!name) return;

    const ref = doc(db, 'leaderboard', uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, { name, score, updatedAt: serverTimestamp() });
    } else if (score > snap.data().score) {
      await setDoc(ref, { name, score, updatedAt: serverTimestamp() }, { merge: true });
    }
  } catch (err) {
    console.warn('Score submit failed:', err);
  }
}

// ── Leaderboard laden ────────────────────────────────────────────────────────
export async function fetchLeaderboard() {
  try {
    const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(50));
    const snap = await getDocs(q);
    const uid = currentUid;
    return snap.docs.map(d => ({
      uid: d.id,
      name: d.data().name,
      score: d.data().score,
      isSelf: d.id === uid,
    }));
  } catch (err) {
    console.warn('Leaderboard fetch failed:', err);
    return [];
  }
}
