module.exports = async (req, res) => {
  const API_URL = process.env.API_URL;

  if (!API_URL) {
    return res.status(500).json({ success: false, error: 'Server configuration missing' });
  }

  try {
    const { method, query, body } = req;
    
    // Construct the target URL with query params
    const targetUrl = new URL(API_URL);
    Object.keys(query).forEach(key => targetUrl.searchParams.append(key, query[key]));

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      // redirect: 'follow' is default for fetch in Node (or not supported exactly like this but it works)
    };

    if (method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(targetUrl.toString(), options);
    const data = await response.json();

    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ success: false, error: 'Something went wrong, please try again' });
  }
};
