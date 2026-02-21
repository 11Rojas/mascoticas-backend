const webpush = require('web-push');
const fs = require('fs');
const keys = webpush.generateVAPIDKeys();
fs.writeFileSync('keys.txt', `PUBLIC_KEY=${keys.publicKey}\nPRIVATE_KEY=${keys.privateKey}`);
console.log('Keys written to keys.txt');
