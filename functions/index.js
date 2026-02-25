const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(value = '') {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function getDescription(post) {
  if (post.description && post.description.trim()) return post.description.trim();
  if (post.content && post.content.trim()) return `${post.content.substring(0, 160)}...`;
  return "Read this article on Chenglin Pua's blog.";
}

function resolveImageUrl(post) {
  if (post.coverImageUrl && !post.coverImageUrl.startsWith('gs://')) return post.coverImageUrl;
  return 'https://via.placeholder.com/1200x630.png?text=Chenglin+Pua+Blog';
}

function getPublishDate(post) {
  if (post.publishDate && typeof post.publishDate.toDate === 'function') {
    return post.publishDate.toDate();
  }
  return new Date();
}

function renderPostHtml({ title, description, imageUrl, canonicalUrl, publishIso, publishReadable, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} | Chenglin Pua's Blog</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:type" content="article" />

  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    headline: title,
    description,
    image: imageUrl,
    author: { '@type': 'Person', name: 'Chenglin Pua' },
    publisher: { '@type': 'Organization', name: "Chenglin Pua's Blog" },
    datePublished: publishIso
  })}</script>

  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-800">
  <header class="bg-white shadow-sm">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <a href="/" class="text-xl font-bold text-gray-900 hover:text-blue-600">&larr; Back to All Articles</a>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <article>
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" class="w-full h-96 object-cover rounded-lg mb-8" />
      <h1 class="text-5xl font-extrabold mb-4 text-gray-900">${escapeHtml(title)}</h1>
      <p class="text-md text-gray-500 mb-8">Published on ${escapeHtml(publishReadable)}</p>
      <div class="mb-10 p-4 bg-gray-100 border-l-4 border-blue-500 rounded-r-lg">
        <p class="text-lg text-gray-700 italic"><strong class="font-semibold not-italic text-gray-900">Summary:</strong> ${escapeHtml(description)}</p>
      </div>
      <div class="prose prose-lg max-w-none leading-8">${bodyHtml}</div>
    </article>
  </main>
</body>
</html>`;
}

exports.renderPost = functions.https.onRequest(async (req, res) => {
  try {
    const parts = req.path.split('/').filter(Boolean);
    const postId = decodeURIComponent(parts[parts.length - 1] || req.query.id || '');
    if (!postId) return res.status(404).send("Sorry, we couldn't find that post.");

    const docSnap = await db.collection('blog post').doc(postId).get();
    if (!docSnap.exists) return res.status(404).send("Sorry, we couldn't find that post.");

    const post = docSnap.data();
    const title = post.title || 'Untitled post';
    const description = getDescription(post);
    const imageUrl = resolveImageUrl(post);
    const publishDate = getPublishDate(post);
    const canonicalUrl = `${req.protocol}://${req.get('host')}/posts/${encodeURIComponent(postId)}`;
    const bodyHtml = `<p>${nl2br(post.content || '')}</p>`;

    const html = renderPostHtml({
      title,
      description,
      imageUrl,
      canonicalUrl,
      publishIso: publishDate.toISOString(),
      publishReadable: publishDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      bodyHtml
    });

    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.status(200).send(html);
  } catch (error) {
    console.error('renderPost failed:', error);
    res.status(500).send('An unexpected error occurred while loading the post.');
  }
});

exports.sitemap = functions.https.onRequest(async (req, res) => {
  try {
    const host = `${req.protocol}://${req.get('host')}`;
    const snapshot = await db.collection('blog post').get();

    const urls = snapshot.docs.map((docSnap) => {
      const post = docSnap.data();
      const lastmod = post.publishDate && typeof post.publishDate.toDate === 'function'
        ? post.publishDate.toDate().toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      return `\n  <url>\n    <loc>${host}/posts/${encodeURIComponent(docSnap.id)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.80</priority>\n  </url>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${host}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>${urls}\n</urlset>`;

    res.set('Content-Type', 'application/xml; charset=UTF-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.status(200).send(xml);
  } catch (error) {
    console.error('sitemap failed:', error);
    res.status(500).send('Failed to generate sitemap');
  }
});
