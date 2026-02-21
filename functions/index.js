const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

exports.renderPost = functions.https.onRequest(async (req, res) => {
    const postId = req.query.id;

    if (!postId) {
        // Redirect to homepage or show an error if no ID is provided
        res.status(404).send("Sorry, we couldn't find that post.");
        return;
    }

    try {
        // 1. Fetch the blog post data from Firestore
        const docSnap = await db.collection('blog post').doc(postId).get();
        if (!docSnap.exists) {
            res.status(404).send("Sorry, that article does not exist.");
            return;
        }
        const post = docSnap.data();

        // 2. Read the HTML template from your hosting directory
        // Ensure the path is correct based on your project structure
        const templatePath = path.resolve(__dirname, '..', 'public', 'post.html');
        let templateHtml = fs.readFileSync(templatePath, 'utf8');

        // 3. Prepare data for injection
        const title = `${post.title} | Chenglin Pua's Blog`;
        const description = (post.description || post.content.substring(0, 160)).replace(/"/g, '&quot;');
        const url = `https://${req.get('host')}/post.html?id=${postId}`;
        const imageUrl = post.coverImageUrl || 'https://example.com/default-image.jpg'; // Provide a default image
        const publishDate = post.publishDate.toDate().toISOString();

        // 4. Replace placeholders in the template
        templateHtml = templateHtml.replace(/__POST_TITLE__/g, title);
        templateHtml = templateHtml.replace(/__POST_DESCRIPTION__/g, description);
        templateHtml = templateHtml.replace(/__POST_URL__/g, url);
        templateHtml = templateHtml.replace(/__POST_IMAGE_URL__/g, imageUrl);
        templateHtml = templateHtml.replace(/__POST_PUBLISH_DATE__/g, publishDate);

        // 5. Send the rendered HTML
        res.set('Cache-Control', 'public, max-age=600, s-maxage=1200'); // Cache the response
        res.status(200).send(templateHtml);

    } catch (error) {
        console.error("Error rendering post:", error);
        res.status(500).send("An error occurred while loading the article.");
    }
});
