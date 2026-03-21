import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD8NXwiYQ55SL6hejiPW0TjS2-JF2T3om0",
  authDomain: "kickoff-c1b6a.firebaseapp.com",
  projectId: "kickoff-c1b6a",
  storageBucket: "kickoff-c1b6a.firebasestorage.app",
  messagingSenderId: "219426284655",
  appId: "1:219426284655:web:1a2f704579c5df67d7599a",
  measurementId: "G-ZLHP6EGP1M",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
