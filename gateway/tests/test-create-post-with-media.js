import axios from 'axios';

const GATEWAY_URL = 'http://localhost:8080/api';

async function diagnose() {
  console.log('🏁 Starting Create Post with Media Diagnostic Test...');

  // 1. Register
  const email = `diag-${Date.now()}@example.com`;
  let token = '';
  try {
    const res = await axios.post(`${GATEWAY_URL}/auth/register`, {
      email,
      password: 'SecurePassword123!',
      name: 'Diagnostic User'
    });
    token = res.data.token.accessToken;
    console.log('✅ Registered Diagnostic User.');
  } catch (err) {
    console.error('❌ Registration failed:', err.response?.data || err.message);
    process.exit(1);
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // 2. Upload image
  let mediaId = '';
  try {
    const fileBlob = new Blob(['fake image content'], { type: 'image/jpeg' });
    const form = new FormData();
    form.append('file', fileBlob, 'diag-image.jpg');

    const res = await axios.post(`${GATEWAY_URL}/media/upload`, form, {
      headers: authHeaders
    });
    mediaId = res.data.id;
    console.log('✅ Uploaded image successfully. Media ID:', mediaId);
  } catch (err) {
    console.error('❌ Image upload failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 3. Create post with this media ID
  try {
    console.log('📡 Sending create post request to post-service...');
    const res = await axios.post(`${GATEWAY_URL}/posts`, {
      content: 'Hôm nay thật là 1 ngày Vide Code tuyệt vời, tôi và đồng nghiệp cùng nhau khịa CEO Vide coding',
      mediaIds: [mediaId],
      visibility: 'friends'
    }, {
      headers: authHeaders
    });
    console.log('✅ POST CREATED SUCCESSFULLY! Data:', res.data);
  } catch (err) {
    console.error('❌ CREATE POST FAILED!');
    console.error('Status:', err.response?.status);
    console.error('Response Data:', err.response?.data);
    console.error('Error Message:', err.message);
  }
}

diagnose();
