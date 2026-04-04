module.exports = async (req, res) => {
  const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
  const IMGBB_URL = 'https://api.imgbb.com/1/upload';

  // 1. Validate ImgBB configuration
  if (!IMGBB_API_KEY) {
    console.error('SERVER_ERROR: IMGBB_API_KEY is not defined.');
    return res.status(500).json({ 
      success: false, 
      error: 'Server configuration missing: IMGBB_API_KEY not found in environment variables.' 
    });
  }

  try {
    const { method, body } = req;

    // 2. Validate request method
    if (method !== 'POST') {
      return res.status(405).json({ 
        success: false, 
        error: `Method ${method} not allowed. Please use POST for image uploads.` 
      });
    }

    // 3. Handle data as multipart/form-data
    const formData = new FormData();
    // Assuming body.image is the image data (base64 or similar)
    if (!body || !body.image) {
      return res.status(400).json({ 
        success: false, 
        error: 'Bad Request: No image data provided.' 
      });
    }

    formData.append('image', body.image);
    formData.append('key', IMGBB_API_KEY);

    // 4. Execute fetch
    const response = await fetch(IMGBB_URL, {
      method: 'POST',
      body: formData,
      // Signal timeout
      signal: AbortSignal.timeout(30000) // 30 second timeout for image uploads
    });

    const data = await response.json();
    
    if (response.ok) {
      return res.status(200).json(data);
    } else {
      console.error('IMGBB_API_ERROR:', data.error || data);
      return res.status(response.status).json({ 
        success: false, 
        error: `ImgBB returned an error: ${data.error?.message || 'Unknown error'}`
      });
    }

  } catch (error) {
    console.error('UPLOAD_PROXY_INTERNAL_ERROR:', error);
    
    let message = 'An unexpected error occurred in the upload proxy.';
    if (error.name === 'TimeoutError') {
      message = 'Request to ImgBB timed out (30s).';
    } else if (error.message.includes('fetch failed')) {
      message = 'Failed to connect to ImgBB. Check your internet connection or the ImgBB service status.';
    }

    return res.status(500).json({ 
      success: false, 
      error: message,
      details: error.message
    });
  }
};
