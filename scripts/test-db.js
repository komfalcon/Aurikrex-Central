const { createClient } = require('@libsql/client');
require('dotenv').config();

async function test() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  console.log('Testing Turso Connection with URL:', url);
  console.log('Auth token length:', authToken ? authToken.length : 0);

  const client = createClient({
    url,
    authToken,
  });

  try {
    const rs = await client.execute('SELECT 1 as test');
    console.log('SUCCESS! Query result:', rs.rows);
  } catch (err) {
    console.error('FAILED with libsql://:', err.message);

    if (url.startsWith('libsql://')) {
      const httpsUrl = url.replace('libsql://', 'https://');
      console.log('\nRetrying with HTTPS URL:', httpsUrl);
      const client2 = createClient({
        url: httpsUrl,
        authToken,
      });
      try {
        const rs2 = await client2.execute('SELECT 1 as test');
        console.log('SUCCESS WITH HTTPS! Query result:', rs2.rows);
      } catch (err2) {
        console.error('FAILED with HTTPS as well:', err2.message);
      }
    }
  }
}

test();
