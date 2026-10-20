import { existsSync, writeFileSync } from 'node:fs';
import webpush from 'web-push';

const destination = '.env.push.local';
if (existsSync(destination)) throw new Error(`${destination} already exists. Keep the existing keys so subscriptions remain valid.`);
const keys = webpush.generateVAPIDKeys();
writeFileSync(destination, `VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n# Set this to your public HTTPS site URL or a contact mailto: address.\nVAPID_SUBJECT=\n`, { mode: 0o600, flag: 'wx' });
console.log(`Created ${destination} (ignored by Git). Import these values into Netlify environment variables with Functions scope. Do not regenerate keys after users subscribe.`);
