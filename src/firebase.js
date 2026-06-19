
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyDlpH6F5n45eX3Va8PgcBmcMBFtpAKzhL4",
  authDomain: "training-portal-ceb7a.firebaseapp.com",
  databaseURL: "https://training-portal-ceb7a-default-rtdb.firebaseio.com",
  projectId: "training-portal-ceb7a",
  storageBucket: "training-portal-ceb7a.firebasestorage.app",
  messagingSenderId: "978649070310",
  appId: "1:978649070310:web:92f83c5343524fbc081927",
  measurementId: "G-R0CZ909EGB"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);