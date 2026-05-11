const { GoogleAuth } = require('google-auth-library');

async function listDbs() {
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const projectId = "gen-lang-client-0207804941";
    const res = await client.request({
      url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases`
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Error calling API:", err.message);
  }
}
listDbs();
