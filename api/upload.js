module.exports = async (req, res) => {
  const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
  const IMGBB_URL = 'https://api.imgbb.com/1/upload';

  if (!IMGBB_API_KEY) {
    return res.status(500).json({ success: false, error: 'Server configuration missing' });
  }

  try {
    const { method, body } = req;

    if (method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    // Expecting base64 image data from the frontend
    const formData = new FormData();
    formData.append('image', body.image);
    formData.append('key', IMGBB_API_KEY);

    const response = await fetch(IMGBB_URL, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Upload Proxy Error:', error);
    res.status(500).json({ success: false, error: 'Something went wrong, please try again' });
  }
};
