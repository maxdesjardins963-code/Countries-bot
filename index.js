'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.TOKEN;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PORT = Number(process.env.PORT) || 3000;

// countries.js must be in the same folder as this file.
const countries = require('./countries');
if (!TOKEN) {
  console.error('[startup] Missing TOKEN environment variable.');
  process.exit(1);
}

if (!countries || typeof countries.init !== 'function') {
  console.error('[startup] countries.js must export init(client, { dataDir }).');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Discord client                                                       */
/* ------------------------------------------------------------------ */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});/* ------------------------------------------------------------------ */
/* Game initialization                                                  */
/* ------------------------------------------------------------------ */

// Create the persistent data directory before starting the game.
fs.mkdirSync(DATA_DIR, { recursive: true });

// Initialize the countries game.
// countries.js handles country spawns, claims, slash commands,
// and all game interactions.
countries.init(client, { dataDir: DATA_DIR });

client.once('clientReady', () => {
  console.log(`[startup] Countries bot is online as ${client.user.tag}.`);
});/* ------------------------------------------------------------------ */
/* Health check server                                                  */
/* ------------------------------------------------------------------ */

// Render requires an open port for Web Service deployments.
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
  });

  res.end('Countries bot is running.');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[startup] Health server listening on port ${PORT}.`);
});

/* ------------------------------------------------------------------ */
/* Error handling                                                       */
/* ------------------------------------------------------------------ */

process.on('unhandledRejection', (error) => {
  console.error('[process] Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[process] Uncaught exception:', error);
});

/* ------------------------------------------------------------------ */
/* Discord login                                                        */
/* ------------------------------------------------------------------ */

client.login(TOKEN).catch((error) => {
  console.error('[startup] Discord login failed:', error);
  process.exit(1);
});
