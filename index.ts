import { Hono } from 'hono'
import { makeWASocket,useMultiFileAuthState } from 'baileys';
import qrcode from "qrcode-terminal";
import * as fs from "fs";
const data = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
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

sock.ev.on("messages.upsert", async (msg) => {
    const message = msg.messages[0];
    if(message.message?.extendedTextMessage){
      console.log("Received message:", message.message.extendedTextMessage.text);
    }
    if(message.message?.extendedTextMessage?.text === "helo"){
      if (message.key.remoteJid) {
        sock.sendMessage(message.key.remoteJid, {text: "Hello!"})
      }
    }
        if(message.message?.extendedTextMessage?.text == "!set") {
        if (message.key.remoteJid) {
        if (!data.uidwa || message.key.remoteJid === data.uidwa + "@c.us") {
        sock.sendMessage(message.key.remoteJid, { text: "You do not have permission to use this command." });
    }
    else {
            const id = message.key.remoteJid;
            data.gwaid = id;
            fs.writeFileSync('id.json', JSON.stringify(data, null, 4));
            sock.sendMessage(message.key.remoteJid, { text: "GroupID set to: " + id });
        }
    }
}})

const app = new Hono()
app.post('/whatsapp', async (c) => {
  const { message } = await c.req.json()
  sock.sendMessage(data.gwaid, {text: message})
  c.text('Message sent to Whatsapp!')
})

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

export default app
