import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB5BJNLI10qW0mDJiJzxieCBbyI8enYyGY",
  authDomain: "controle-estoques-pmml.firebaseapp.com",
  projectId: "controle-estoques-pmml",
  storageBucket: "controle-estoques-pmml.firebasestorage.app",
  messagingSenderId: "883009770023",
  appId: "1:883009770023:web:665560d46d0c5cd4cdf402"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
