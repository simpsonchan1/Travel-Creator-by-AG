import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
    try {
        // We don't have the user's UID, so we can't easily query /users/<uid>/projects unless we know it.
        // Let's just try to check if there are any users.
        const usersCol = collection(db, 'users');
        const usersSnap = await getDocs(usersCol);
        if (usersSnap.empty) {
            console.log("No users found. Rules might block this or DB is empty.");
        } else {
            console.log(`Found ${usersSnap.size} users.`);
            usersSnap.forEach(doc => {
                console.log(doc.id, doc.data());
            });
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
