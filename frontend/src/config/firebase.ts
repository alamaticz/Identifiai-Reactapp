// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBBhD_G2EXYf4V7uy60IOUXQdirM94RkGc",
    authDomain: "identifai-619c7.firebaseapp.com",
    projectId: "identifai-619c7",
    storageBucket: "identifai-619c7.firebasestorage.app",
    messagingSenderId: "1064131476086",
    appId: "1:1064131476086:web:534506dd27b8100780fd57",
    measurementId: "G-BT4Q173GRT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

export { app, analytics, auth };
