const crypto = require('crypto');

console.log('Generating 2048-bit RSA Key pair for Aurikrex-Central RS256 JWT Signing...\n');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

const privateKeyB64 = Buffer.from(privateKey).toString('base64');
const publicKeyB64 = Buffer.from(publicKey).toString('base64');

console.log('================================================================');
console.log('RSA PRIVATE KEY (Base64) - Add to Aurikrex-Central .env:');
console.log('================================================================');
console.log(`RSA_PRIVATE_KEY_B64="${privateKeyB64}"\n`);

console.log('================================================================');
console.log('RSA PUBLIC KEY (Base64) - Add to Aurikrex-Central .env:');
console.log('================================================================');
console.log(`RSA_PUBLIC_KEY_B64="${publicKeyB64}"\n`);

console.log('================================================================');
console.log('Raw PEM Public Key (Published at /.well-known/jwks.json for CBT, Library, Bytes, Phorynt):');
console.log('================================================================');
console.log(publicKey);
