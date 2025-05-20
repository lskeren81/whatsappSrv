import { Hono } from 'hono'
import { makeWASocket,useMultiFileAuthState } from 'baileys';
import qrcode from "qrcode-terminal";

const { state, saveCreds } = await useMultiFileAuthState('auth_info')
const sock = makeWASocket({
  auth: state,
  syncFullHistory: false
})
sock.ev.on('creds.update', saveCreds)

sock.ev.on("connection.update", handleConnectionUpdate);
async function handleConnectionUpdate(update: any) {
    const { qr, connection, lastDisconnect } = update;
    if (qr) {
        qrcode.generate(qr, { small: true });
        console.log("Scan the QR code above to log in to WhatsApp.");
    }
    if (connection === "close") {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
        console.log("Connection closed. Reconnecting...", shouldReconnect);
        if (shouldReconnect) {
            const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
            const newSock = makeWASocket({ syncFullHistory: false, auth: state });
            newSock.ev.on("creds.update", saveCreds);
            newSock.ev.on("connection.update", handleConnectionUpdate);
        } else {
            console.log("Session ended. Delete auth_info_baileys and restart to generate a new QR.");
        }
    }
}

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

export default app
