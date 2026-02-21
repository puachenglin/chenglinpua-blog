const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp();
const db = admin.firestore();

exports.renderPost = functions.https.onRequest(async (req, res) => {
    // --- THIS IS THE PART TO CHANGE ---
    // OLD way of getting the ID:
    // const postId = req.query.id;

    // NEW way of getting the ID from the path:
    const parts = req.path.split('/');
    const postId = parts.pop(); // Gets the last part of the URL path (e.g., 'my-first-post')

    if (!postId) {
        // ... (rest of your code is the same)
        res.status(404).send("Sorry, we couldn't find that post.");
        return;
    }
    
    // The rest of your function code stays exactly the same!
    try {
        const docSnap = await db.collection('blog post').doc(postId).get();
        // ... etc. ...
        // ...
        // Make sure the `url` variable in your function also reflects the new structure
        const url = `https://${req.get('host')}/posts/${postId}`; // ✅ Update this line too
        // ...
    } catch (error) {
        //...
    }
});
