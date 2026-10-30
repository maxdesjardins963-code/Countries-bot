/* =====================================================================
   Empire Countries Bot  -  index.js
   Env vars: TOKEN, GUILD_ID, COUNTRY_CHANNEL_ID, EMBED_PERMS_ROLE_ID
   Optional: SPAWN_MS (default 210000 = 3m30s), DATA_FILE (default ./data.json), PORT
   ===================================================================== */
const fs = require('fs');
const http = require('http');
const {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, SlashCommandBuilder, MessageFlags, Events,
} = require('discord.js');

const { MongoClient } = require('mongodb');

const { TOKEN, GUILD_ID, COUNTRY_CHANNEL_ID, EMBED_PERMS_ROLE_ID, MONGODB_URI } = process.env;
const SPAWN_MS = Number(process.env.SPAWN_MS) || 210000;   // 3 min 30 s
const FARM_COOLDOWN = 80 * 1000;                            // 1 min 20 s
const DAILY_COOLDOWN = 20 * 60 * 60 * 1000;
const WAR_COOLDOWN = 5 * 60 * 1000;
const MAX_MASTERY = 50;
const CLAIM_WINDOW = 3 * 60 * 1000;
const DATA_FILE = process.env.DATA_FILE || './data.json';

if (!TOKEN || !GUILD_ID || !COUNTRY_CHANNEL_ID) {
  console.error('Missing env vars: TOKEN, GUILD_ID and COUNTRY_CHANNEL_ID are required.');
  process.exit(1);
}

/* ------------------------------ COUNTRIES ------------------------------
   [name, rarity, trade%, sociable%, war%, allies%]   (world of 1750)     */
const RAW = [
  ['Great Britain','Legendary',85,55,80,70],['France','Legendary',75,60,85,65],
  ['Qing China','Legendary',90,25,75,30],['Ottoman Empire','Legendary',80,40,90,45],
  ['Russian Empire','Legendary',50,35,90,50],
  ['Spain','Epic',70,50,70,60],['Dutch Republic','Epic',95,65,40,75],
  ['Habsburg Austria','Epic',55,60,75,80],['Prussia','Epic',40,35,92,55],
  ['Portugal','Epic',80,55,45,70],['Sweden','Epic',45,50,70,60],
  ['Tokugawa Japan','Epic',35,15,65,10],['Maratha Confederacy','Epic',50,40,85,45],
  ['Mughal Empire','Epic',75,45,60,50],['Afsharid Persia','Epic',55,30,85,35],
  ['Venice','Epic',90,70,35,65],
  ['Joseon Korea','Rare',45,20,40,25],['Denmark-Norway','Rare',60,55,50,60],
  ['Poland-Lithuania','Rare',45,60,55,55],['Savoy','Rare',40,50,60,65],
  ['Genoa','Rare',80,60,25,60],['Papal States','Rare',50,75,15,85],
  ['Kingdom of Naples','Rare',45,55,40,55],['Bavaria','Rare',40,50,55,60],
  ['Saxony','Rare',50,55,45,60],['Morocco','Rare',55,35,60,40],
  ['Algiers','Rare',60,25,75,30],['Mamluk Egypt','Rare',65,40,55,40],
  ['Ethiopia','Rare',30,35,60,35],['Ashanti','Rare',60,40,75,35],
  ['Dahomey','Rare',50,25,85,25],['Siam','Rare',65,50,50,45],
  ['Burma','Rare',40,25,75,25],['Mysore','Rare',45,30,70,35],
  ['Hyderabad','Rare',60,50,45,55],['Oman','Rare',80,55,40,50],
  ['Durrani Empire','Rare',40,30,85,30],['Iroquois Confederacy','Rare',50,70,65,85],
  ['Comanche','Rare',30,20,90,25],['Crimean Khanate','Rare',40,25,80,40],
  ['Tibet','Uncommon',30,45,15,45],['Switzerland','Uncommon',65,70,30,30],
  ['Tuscany','Uncommon',60,70,20,60],['Hanover','Uncommon',45,55,45,70],
  ['Wallachia','Uncommon',45,45,40,40],['Moldavia','Uncommon',40,45,40,40],
  ['Montenegro','Uncommon',15,30,70,40],['Ragusa','Uncommon',75,75,10,65],
  ['Knights of Malta','Uncommon',55,50,60,60],['Tunis','Uncommon',55,40,45,40],
  ['Tripoli','Uncommon',50,30,55,35],['Oyo','Uncommon',55,40,65,40],
  ['Kongo','Uncommon',40,45,40,45],['Benin','Uncommon',60,40,45,35],
  ['Bornu','Uncommon',50,35,50,35],['Buganda','Uncommon',40,35,60,35],
  ['Merina','Uncommon',35,40,55,30],['Yemen','Uncommon',45,35,35,40],
  ['Emirate of Diriyah','Uncommon',25,30,65,45],['Bukhara','Uncommon',65,45,40,40],
  ['Khiva','Uncommon',45,25,60,30],['Kazakh Khanate','Uncommon',30,40,70,45],
  ['Nepal','Uncommon',30,35,55,30],['Ryukyu','Uncommon',80,75,5,65],
  ['Aceh','Uncommon',65,40,50,40],['Mataram','Uncommon',45,35,55,35],
  ['Brunei','Uncommon',60,45,35,40],['Gowa','Uncommon',65,45,50,40],
  ['Dai Viet','Uncommon',45,30,65,30],['Sikh Confederacy','Uncommon',40,40,80,50],
  ['Travancore','Uncommon',65,50,40,50],['Bengal','Uncommon',80,45,35,40],
  ['Cherokee','Uncommon',45,60,55,65],['Creek','Uncommon',40,55,60,60],
  ['Lakota','Uncommon',25,35,80,45],
  ['Mapuche','Common',20,25,80,30],['Guarani','Common',30,50,45,45],
  ['Georgia','Common',35,45,50,60],['Hawaii','Common',25,55,55,40],
  ['Tonga','Common',25,60,50,50],['Maori','Common',20,40,75,35],
  ['Cree','Common',45,60,30,55],['Greenland Inuit','Common',20,60,10,30],
  ['Sami','Common',30,55,10,40],['Haida','Common',40,45,55,30],
  ['Aleut','Common',20,40,25,25],['Kandy','Common',40,45,40,45],
  ['Ahom Kingdom','Common',35,40,50,35],['Luang Prabang','Common',35,55,25,45],
  ['Cambodia','Common',40,45,30,40],['Bhutan','Common',20,35,30,35],
  ['Futa Toro','Common',40,40,45,35],['Kuba Kingdom','Common',35,50,30,40],
  ['Rozvi Empire','Common',35,35,55,30],['Wadai Sultanate','Common',40,30,50,30],
  ['Darfur Sultanate','Common',40,35,50,35],['Funj Sultanate','Common',45,40,45,40],
  ['Kingdom of Kaffa','Common',30,30,45,30],['Blackfoot Confederacy','Common',30,40,70,45],
  ['Apache','Common',20,20,85,25],
];
const COUNTRIES = RAW.map(([name, rarity, trade, sociable, war, allies]) => ({ name, rarity, trade, sociable, war, allies }));
const BY_NAME = new Map(COUNTRIES.map(c => [c.name.toLowerCase(), c]));
const RARITY_WEIGHT = { Common: 50, Uncommon: 28, Rare: 14, Epic: 6, Legendary: 2 };
const RARITY_COLOR = { Common: 0x95a5a6, Uncommon: 0x2ecc71, Rare: 0x3498db, Epic: 0x9b59b6, Legendary: 0xf1c40f };

/* ------------------------------ DATABASE ------------------------------ */
let db = { users: {}, factions: {} };
let mongoCol = null;

// Load data: from MongoDB if MONGODB_URI is set (survives redeploys), otherwise from a local file.
async function loadDb() {
  if (MONGODB_URI) {
    const mc = new MongoClient(MONGODB_URI);
    await mc.connect();
    mongoCol = mc.db('countriesbot').collection('state');
    const doc = await mongoCol.findOne({ _id: 'main' });
    if (doc && doc.data) db = { users: {}, factions: {}, ...JSON.parse(doc.data) };
    console.log(`Data loaded from MongoDB (${Object.keys(db.users).length} players).`);
  } else {
    console.warn('MONGODB_URI not set: using a local file, data will be lost on redeploy!');
    try { if (fs.existsSync(DATA_FILE)) db = { users: {}, factions: {}, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }; }
    catch (e) { console.error('Could not read data file, starting fresh:', e.message); }
  }
}
async function flush() {
  try {
    if (mongoCol) await mongoCol.replaceOne({ _id: 'main' }, { _id: 'main', data: JSON.stringify(db) }, { upsert: true });
    else { fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(db)); fs.renameSync(DATA_FILE + '.tmp', DATA_FILE); }
  } catch (e) { console.error('Save failed:', e.message); }
}
let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; flush(); }, 1500);
}
function U(id) {
  if (!db.users[id]) db.users[id] = { countries: {}, lastFarm: 0, lastDaily: 0, lastWar: 0, redeemed: false, wins: 0, losses: 0, faction: null, allies: [] };
  return db.users[id];
}

/* ------------------------------ HELPERS ------------------------------ */
const bar = (m) => { const f = Math.round((m / MAX_MASTERY) * 10); return `[${'#'.repeat(f)}${'-'.repeat(10 - f)}] ${m}/${MAX_MASTERY}`; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const eph = { flags: MessageFlags.Ephemeral };
const masteredCount = (u) => Object.values(u.countries).filter(m => m >= MAX_MASTERY).length;
const totalMastery = (u) => Object.values(u.countries).reduce((a, b) => a + b, 0);
function weightedCountry() {
  const pool = COUNTRIES.map(c => [c, RARITY_WEIGHT[c.rarity]]);
  let r = Math.random() * pool.reduce((s, [, w]) => s + w, 0);
  for (const [c, w] of pool) { if ((r -= w) <= 0) return c; }
  return COUNTRIES[0];
}
function bestWarCountry(u) {
  let best = null, score = -1;
  for (const [n, m] of Object.entries(u.countries)) {
    const c = BY_NAME.get(n.toLowerCase()); if (!c) continue;
    const s = c.war * (0.5 + m / MAX_MASTERY);
    if (s > score) { score = s; best = { c, m }; }
  }
  return best;
}
const factionKey = (n) => n.trim().toLowerCase();
function factionPower(f) { return f.members.reduce((s, id) => s + totalMastery(U(id)), 0); }

/* ------------------------------ CLIENT ------------------------------ */
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

/* ------------------------------ COMMANDS ------------------------------ */
const commands = [
  new SlashCommandBuilder().setName('collection').setDescription('See the countries you (or someone else) own')
    .addUserOption(o => o.setName('user').setDescription('Whose collection?')),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Top players and factions')
    .addStringOption(o => o.setName('type').setDescription('What to rank').addChoices(
      { name: 'Total mastery', value: 'mastery' }, { name: 'Countries owned', value: 'countries' },
      { name: 'War victories', value: 'wins' }, { name: 'Factions', value: 'factions' })),
  new SlashCommandBuilder().setName('farm').setDescription('Farm mastery on one of your countries (1m20s cooldown)')
    .addStringOption(o => o.setName('country').setDescription('Which country?').setAutocomplete(true)),
  new SlashCommandBuilder().setName('redeem').setDescription('Redeem the embed/GIF perms role (needs 3 countries at mastery 50)'),
  new SlashCommandBuilder().setName('war').setDescription('Declare war on another player')
    .addUserOption(o => o.setName('target').setDescription('Who do you attack?').setRequired(true))
    .addStringOption(o => o.setName('country').setDescription('Your country (default: your strongest)').setAutocomplete(true)),
  new SlashCommandBuilder().setName('allies').setDescription('Manage your alliances')
    .addSubcommand(s => s.setName('propose').setDescription('Propose an alliance').addUserOption(o => o.setName('user').setDescription('Future ally').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List your allies'))
    .addSubcommand(s => s.setName('break').setDescription('Break an alliance').addUserOption(o => o.setName('user').setDescription('Ally to drop').setRequired(true))),
  new SlashCommandBuilder().setName('faction').setDescription('Factions')
    .addSubcommand(s => s.setName('create').setDescription('Create a faction').addStringOption(o => o.setName('name').setDescription('Faction name').setRequired(true).setMaxLength(32)))
    .addSubcommand(s => s.setName('join').setDescription('Join a faction').addStringOption(o => o.setName('name').setDescription('Faction name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('leave').setDescription('Leave your faction'))
    .addSubcommand(s => s.setName('info').setDescription('Faction info').addStringOption(o => o.setName('name').setDescription('Faction name (default: yours)').setAutocomplete(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all factions'))
    .addSubcommand(s => s.setName('disband').setDescription('Disband your faction (leader only)')),
  // --- 3 extras ---
  new SlashCommandBuilder().setName('profile').setDescription('Your empire at a glance')
    .addUserOption(o => o.setName('user').setDescription('Whose profile?')),
  new SlashCommandBuilder().setName('trade').setDescription('Swap one of your countries with another player (mastery resets to 0)')
    .addUserOption(o => o.setName('user').setDescription('Trade partner').setRequired(true))
    .addStringOption(o => o.setName('give').setDescription('Country you give').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('get').setDescription('Country you want').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('daily').setDescription('Claim your daily royal tribute (+5 mastery on a random country)'),
  new SlashCommandBuilder().setName('give').setDescription('Give a country to another player')
    .addUserOption(o => o.setName('to').setDescription('Who receives it?').setRequired(true))
    .addStringOption(o => o.setName('country').setDescription('Country to give').setRequired(true).setAutocomplete(true)),
].map(c => c.toJSON());

/* ------------------------------ SPAWNING ------------------------------ */
const spawns = new Map(); // messageId -> { country, claimedBy }
async function spawnCountry() {
  try {
    const channel = await client.channels.fetch(COUNTRY_CHANNEL_ID);
    const c = weightedCountry();
    const embed = new EmbedBuilder()
      .setColor(RARITY_COLOR[c.rarity])
      .setTitle(`A wild country appeared: ${c.name}`)
      .setDescription(`The year is 1750. Envoys of **${c.name}** are at your gates.\nBe the first to welcome them.`)
      .addFields(
        { name: 'Rarity', value: c.rarity, inline: true },
        { name: 'Trade', value: `${c.trade}%`, inline: true },
        { name: 'Sociable', value: `${c.sociable}%`, inline: true },
        { name: 'War', value: `${c.war}%`, inline: true },
        { name: 'Allies', value: `${c.allies}%`, inline: true },
      );
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('claim').setLabel('Take them in').setStyle(ButtonStyle.Success));
    const msg = await channel.send({ embeds: [embed], components: [row] });
    spawns.set(msg.id, { country: c, claimedBy: null });
    setTimeout(async () => {
      const s = spawns.get(msg.id);
      if (s && !s.claimedBy) {
        spawns.delete(msg.id);
        const e = EmbedBuilder.from(embed).setFooter({ text: 'The envoys left, nobody welcomed them.' });
        msg.edit({ embeds: [e], components: [] }).catch(() => {});
      }
    }, CLAIM_WINDOW);
  } catch (e) { console.error('Spawn failed:', e.message); }
}

/* ------------------------------ FARM EVENTS ------------------------------ */
const FARM_EVENTS = [
  ['Trade caravans doubled the harvest', 1], ['A bumper harvest filled the granaries', 1],
  ['Scholars opened a new academy', 1], ['A royal wedding boosted morale', 1],
  ['Merchants struck a lucrative deal', 1], ['A wandering engineer improved the roads', 1],
  ['A great festival united the people', 2], ['A hidden silver mine was discovered', 2],
  ['A quiet day, the fields did their work', 0], ['Rain was kind this season', 0],
];

/* ------------------------------ INTERACTIONS ------------------------------ */
const pendingTrades = new Map();
const pendingAllies = new Map();
let counter = 0;
const nid = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isAutocomplete()) return handleAutocomplete(i);
    if (i.isButton()) return handleButton(i);
    if (!i.isChatInputCommand()) return;
    const handlers = { collection, leaderboard, farm, redeem, war, allies, faction, profile, trade, daily, give };
    await handlers[i.commandName]?.(i);
  } catch (e) {
    console.error(e);
    const out = { content: 'Something went wrong, try again.', ...eph };
    if (i.deferred || i.replied) i.followUp(out).catch(() => {}); else i.reply?.(out).catch(() => {});
  }
});

function handleAutocomplete(i) {
  const f = i.options.getFocused(true);
  const q = f.value.toLowerCase();
  const u = U(i.user.id);
  let choices = [];
  if (i.commandName === 'faction') {
    choices = Object.values(db.factions).map(x => x.name);
  } else if (i.commandName === 'trade' && f.name === 'get') {
    const t = i.options.get('user')?.value;
    choices = t ? Object.keys(U(t).countries) : [];
  } else if (i.commandName === 'give' && i.memberPermissions?.has('Administrator')) {
    choices = [...new Set([...Object.keys(u.countries), ...COUNTRIES.map(c => c.name)])];
  } else {
    choices = Object.keys(u.countries);
  }
  return i.respond(choices.filter(n => n.toLowerCase().includes(q)).slice(0, 25).map(n => ({ name: n, value: n })));
}

async function handleButton(i) {
  const [kind, id] = i.customId.split(':');
  if (kind === 'claim') {
    const s = spawns.get(i.message.id);
    if (!s) return i.reply({ content: 'These envoys already left.', ...eph });
    if (s.claimedBy) return i.reply({ content: 'Too late, someone else got them first.', ...eph });
    s.claimedBy = i.user.id; // synchronous = first click wins
    const u = U(i.user.id); const name = s.country.name;
    let note;
    if (u.countries[name] === undefined) { u.countries[name] = 0; note = 'A new country joins your empire.'; }
    else { u.countries[name] = Math.min(MAX_MASTERY, u.countries[name] + 5); note = 'You already had them, so they brought gifts: +5 mastery.'; }
    save();
    const e = EmbedBuilder.from(i.message.embeds[0]).addFields({ name: 'Claimed by', value: `<@${i.user.id}>` }).setFooter({ text: note });
    await i.update({ embeds: [e], components: [] });
    setTimeout(() => spawns.delete(i.message.id), 60000);
    return;
  }
  if (kind === 'trade') {
    const t = pendingTrades.get(id);
    if (!t) return i.reply({ content: 'This offer expired.', ...eph });
    if (i.user.id !== t.to) return i.reply({ content: 'This offer is not for you.', ...eph });
    pendingTrades.delete(id);
    if (i.customId.startsWith('trade_no')) return i.update({ content: `<@${t.to}> declined the trade.`, components: [] });
    const a = U(t.from), b = U(t.to);
    if (a.countries[t.give] === undefined || b.countries[t.get] === undefined || a.countries[t.get] !== undefined || b.countries[t.give] !== undefined)
      return i.update({ content: 'The trade is no longer possible.', components: [] });
    delete a.countries[t.give]; delete b.countries[t.get];
    a.countries[t.get] = 0; b.countries[t.give] = 0; save();
    return i.update({ content: `Trade done: <@${t.from}> gave **${t.give}** and received **${t.get}**. Mastery of both resets to 0.`, components: [] });
  }
  if (kind === 'ally') {
    const t = pendingAllies.get(id);
    if (!t) return i.reply({ content: 'This proposal expired.', ...eph });
    if (i.user.id !== t.to) return i.reply({ content: 'This proposal is not for you.', ...eph });
    pendingAllies.delete(id);
    if (i.customId.startsWith('ally_no')) return i.update({ content: `<@${t.to}> refused the alliance.`, components: [] });
    const a = U(t.from), b = U(t.to);
    if (!a.allies.includes(t.to)) a.allies.push(t.to);
    if (!b.allies.includes(t.from)) b.allies.push(t.from);
    save();
    return i.update({ content: `<@${t.from}> and <@${t.to}> are now allies.`, components: [] });
  }
}

/* ---- /collection ---- */
async function collection(i) {
  const user = i.options.getUser('user') || i.user;
  const u = U(user.id);
  const entries = Object.entries(u.countries).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return i.reply({ content: `${user.username} has no countries yet.`, ...eph });
  let lines = entries.map(([n, m]) => { const c = BY_NAME.get(n.toLowerCase()); return `**${n}** (${c?.rarity ?? '?'}) ${bar(m)}`; });
  let text = lines.join('\n');
  if (text.length > 3900) { while (lines.join('\n').length > 3850) lines.pop(); text = lines.join('\n') + `\n... and ${entries.length - lines.length} more`; }
  const e = new EmbedBuilder().setColor(0x3498db).setTitle(`${user.username}'s collection`)
    .setDescription(text).setFooter({ text: `${entries.length}/${COUNTRIES.length} countries - ${masteredCount(u)} mastered` });
  return i.reply({ embeds: [e] });
}

/* ---- /leaderboard ---- */
async function leaderboard(i) {
  const type = i.options.getString('type') || 'mastery';
  let rows, title;
  if (type === 'factions') {
    title = 'Top factions';
    rows = Object.values(db.factions).map(f => ({ label: `**${f.name}** (${f.members.length} members)`, v: factionPower(f), unit: 'mastery' }));
  } else {
    const fn = { mastery: u => totalMastery(u), countries: u => Object.keys(u.countries).length, wins: u => u.wins }[type];
    title = { mastery: 'Top total mastery', countries: 'Top collectors', wins: 'Top warlords' }[type];
    rows = Object.entries(db.users).map(([id, u]) => ({ label: `<@${id}>`, v: fn(u), unit: type === 'wins' ? 'wins' : type === 'countries' ? 'countries' : 'mastery' }));
  }
  rows = rows.filter(r => r.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
  const d = rows.length ? rows.map((r, n) => `**${n + 1}.** ${r.label} - ${r.v} ${r.unit}`).join('\n') : 'Nobody on the board yet.';
  return i.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle(title).setDescription(d)] });
}

/* ---- /farm ---- */
async function farm(i) {
  const u = U(i.user.id);
  const left = u.lastFarm + FARM_COOLDOWN - Date.now();
  if (left > 0) return i.reply({ content: `Your people are still working. Try again <t:${Math.ceil((Date.now() + left) / 1000)}:R>.`, ...eph });
  const owned = Object.keys(u.countries);
  if (!owned.length) return i.reply({ content: 'You own no country yet. Wait for the next envoys to arrive.', ...eph });
  let name = i.options.getString('country');
  if (name) {
    name = owned.find(n => n.toLowerCase() === name.toLowerCase());
    if (!name) return i.reply({ content: 'You do not own that country.', ...eph });
  } else {
    const open = owned.filter(n => u.countries[n] < MAX_MASTERY);
    if (!open.length) return i.reply({ content: 'All your countries are already at max mastery.', ...eph });
    name = pick(open);
  }
  if (u.countries[name] >= MAX_MASTERY) return i.reply({ content: `${name} is already at max mastery.`, ...eph });
  const [text, bonus] = pick(FARM_EVENTS);
  const gain = 1 + bonus;
  u.countries[name] = Math.min(MAX_MASTERY, u.countries[name] + gain);
  u.lastFarm = Date.now(); save();
  const m = u.countries[name];
  const e = new EmbedBuilder().setColor(0x57f287).setTitle(name)
    .setDescription(`You gained **+${gain}** mastery.\n${bar(m)}\n\n${text}${bonus ? ` (+${bonus})` : ''}.${m >= MAX_MASTERY ? `\n\n**${name} is now fully mastered.**` : ''}`);
  return i.reply({ embeds: [e] });
}

/* ---- /redeem ---- */
async function redeem(i) {
  const u = U(i.user.id);
  if (!EMBED_PERMS_ROLE_ID) return i.reply({ content: 'The reward role is not configured.', ...eph });
  const n = masteredCount(u);
  if (n < 3) return i.reply({ content: `You need 3 countries at mastery ${MAX_MASTERY}. You have ${n}.`, ...eph });
  const member = await i.guild.members.fetch(i.user.id);
  if (member.roles.cache.has(EMBED_PERMS_ROLE_ID)) return i.reply({ content: 'You already have the embed perms role.', ...eph });
  try { await member.roles.add(EMBED_PERMS_ROLE_ID); }
  catch { return i.reply({ content: 'I could not give you the role. An admin needs to put my role above it and give me Manage Roles.', ...eph }); }
  u.redeemed = true; save();
  return i.reply({ content: `Congratulations <@${i.user.id}>, you earned embed links and GIF permissions.` });
}

/* ---- /war ---- */
async function war(i) {
  const target = i.options.getUser('target');
  if (target.bot || target.id === i.user.id) return i.reply({ content: 'Pick another player to fight.', ...eph });
  const a = U(i.user.id), d = U(target.id);
  const left = a.lastWar + WAR_COOLDOWN - Date.now();
  if (left > 0) return i.reply({ content: `Your armies are resting. Try again <t:${Math.ceil((Date.now() + left) / 1000)}:R>.`, ...eph });
  if (a.allies.includes(target.id)) return i.reply({ content: 'You cannot attack an ally. Break the alliance first.', ...eph });
  if (a.faction && a.faction === d.faction) return i.reply({ content: 'You cannot attack a member of your own faction.', ...eph });
  let att;
  const chosen = i.options.getString('country');
  if (chosen) {
    const n = Object.keys(a.countries).find(x => x.toLowerCase() === chosen.toLowerCase());
    if (!n) return i.reply({ content: 'You do not own that country.', ...eph });
    att = { c: BY_NAME.get(n.toLowerCase()), m: a.countries[n] };
  } else att = bestWarCountry(a);
  const def = bestWarCountry(d);
  if (!att) return i.reply({ content: 'You have no country to send to war.', ...eph });
  if (!def) return i.reply({ content: `${target.username} has no country to defend.`, ...eph });

  const support = (u) => {
    let s = 0;
    for (const id of u.allies.slice(0, 3)) { const b = bestWarCountry(U(id)); if (b) s += 3 + b.c.allies / 10; }
    const f = u.faction && db.factions[u.faction]; if (f) s += Math.min(10, f.members.length * 2);
    return s;
  };
  const power = (x, u) => x.c.war * (0.5 + x.m / MAX_MASTERY) + support(u) + rnd(0, 40);
  const pa = power(att, a), pd = power(def, d);
  a.lastWar = Date.now();
  const won = pa > pd;
  const [wU, wC, lU, lC] = won ? [a, att, d, def] : [d, def, a, att];
  wU.wins++; lU.losses++;
  wU.countries[wC.c.name] = Math.min(MAX_MASTERY, wU.countries[wC.c.name] + 3);
  lU.countries[lC.c.name] = Math.max(0, lU.countries[lC.c.name] - 2);
  save();
  const e = new EmbedBuilder().setColor(won ? 0x57f287 : 0xed4245).setTitle(`War: ${att.c.name} vs ${def.c.name}`)
    .setDescription(`<@${i.user.id}> sent **${att.c.name}** against <@${target.id}>'s **${def.c.name}**.\n\n` +
      `Attacker strength: **${pa.toFixed(0)}** - Defender strength: **${pd.toFixed(0)}**\n\n` +
      `**${wC.c.name}** wins and gains +3 mastery. **${lC.c.name}** loses 2 mastery.`);
  return i.reply({ embeds: [e] });
}

/* ---- /allies ---- */
async function allies(i) {
  const sub = i.options.getSubcommand(); const u = U(i.user.id);
  if (sub === 'list') {
    return i.reply({ embeds: [new EmbedBuilder().setColor(0x3498db).setTitle('Your allies')
      .setDescription(u.allies.length ? u.allies.map(id => `<@${id}>`).join('\n') : 'You have no allies yet.')] });
  }
  const user = i.options.getUser('user');
  if (user.bot || user.id === i.user.id) return i.reply({ content: 'Pick another player.', ...eph });
  if (sub === 'break') {
    if (!u.allies.includes(user.id)) return i.reply({ content: 'You are not allied with that player.', ...eph });
    u.allies = u.allies.filter(x => x !== user.id); U(user.id).allies = U(user.id).allies.filter(x => x !== i.user.id); save();
    return i.reply({ content: `The alliance between <@${i.user.id}> and <@${user.id}> is over.` });
  }
  if (u.allies.includes(user.id)) return i.reply({ content: 'You are already allies.', ...eph });
  if (u.allies.length >= 5) return i.reply({ content: 'You can have at most 5 allies.', ...eph });
  const id = nid(); pendingAllies.set(id, { from: i.user.id, to: user.id }); setTimeout(() => pendingAllies.delete(id), 5 * 60 * 1000);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ally_yes:${id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ally_no:${id}`).setLabel('Decline').setStyle(ButtonStyle.Danger));
  return i.reply({ content: `<@${user.id}>, <@${i.user.id}> proposes an alliance. Allies support each other in wars.`, components: [row] });
}

/* ---- /faction ---- */
async function faction(i) {
  const sub = i.options.getSubcommand(); const u = U(i.user.id);
  const mine = u.faction && db.factions[u.faction];
  if (sub === 'create') {
    const name = i.options.getString('name').trim(); const key = factionKey(name);
    if (u.faction) return i.reply({ content: 'Leave your current faction first.', ...eph });
    if (db.factions[key]) return i.reply({ content: 'That faction name is taken.', ...eph });
    db.factions[key] = { name, leader: i.user.id, members: [i.user.id], created: Date.now() }; u.faction = key; save();
    return i.reply({ content: `The faction **${name}** has been founded by <@${i.user.id}>.` });
  }
  if (sub === 'join') {
    const key = factionKey(i.options.getString('name')); const f = db.factions[key];
    if (!f) return i.reply({ content: 'No faction with that name.', ...eph });
    if (u.faction) return i.reply({ content: 'Leave your current faction first.', ...eph });
    if (f.members.length >= 25) return i.reply({ content: 'That faction is full (25 members).', ...eph });
    f.members.push(i.user.id); u.faction = key; save();
    return i.reply({ content: `<@${i.user.id}> joined **${f.name}**.` });
  }
  if (sub === 'leave') {
    if (!mine) return i.reply({ content: 'You are not in a faction.', ...eph });
    mine.members = mine.members.filter(x => x !== i.user.id); u.faction = null;
    if (!mine.members.length) delete db.factions[factionKey(mine.name)];
    else if (mine.leader === i.user.id) mine.leader = mine.members[0];
    save();
    return i.reply({ content: `You left **${mine.name}**.` });
  }
  if (sub === 'disband') {
    if (!mine || mine.leader !== i.user.id) return i.reply({ content: 'Only a faction leader can do that.', ...eph });
    for (const id of mine.members) U(id).faction = null;
    delete db.factions[factionKey(mine.name)]; save();
    return i.reply({ content: `The faction **${mine.name}** has been disbanded.` });
  }
  if (sub === 'list') {
    const list = Object.values(db.factions).sort((a, b) => factionPower(b) - factionPower(a)).slice(0, 20);
    return i.reply({ embeds: [new EmbedBuilder().setColor(0x9b59b6).setTitle('Factions')
      .setDescription(list.length ? list.map(f => `**${f.name}** - ${f.members.length} members - ${factionPower(f)} mastery`).join('\n') : 'No faction yet. Use /faction create.')] });
  }
  if (sub === 'info') {
    const n = i.options.getString('name'); const f = n ? db.factions[factionKey(n)] : mine;
    if (!f) return i.reply({ content: 'Faction not found.', ...eph });
    return i.reply({ embeds: [new EmbedBuilder().setColor(0x9b59b6).setTitle(f.name)
      .addFields({ name: 'Leader', value: `<@${f.leader}>`, inline: true }, { name: 'Power', value: `${factionPower(f)} mastery`, inline: true },
        { name: `Members (${f.members.length})`, value: f.members.map(id => `<@${id}>`).join(', ').slice(0, 1000) })
      .setFooter({ text: `War bonus for members: +${Math.min(10, f.members.length * 2)}` })] });
  }
}

/* ---- /profile ---- */
async function profile(i) {
  const user = i.options.getUser('user') || i.user; const u = U(user.id);
  const best = bestWarCountry(u); const f = u.faction && db.factions[u.faction];
  const e = new EmbedBuilder().setColor(0x3498db).setTitle(`${user.username}'s empire`)
    .addFields(
      { name: 'Countries', value: `${Object.keys(u.countries).length}/${COUNTRIES.length}`, inline: true },
      { name: 'Mastered', value: `${masteredCount(u)}`, inline: true },
      { name: 'Total mastery', value: `${totalMastery(u)}`, inline: true },
      { name: 'Wars', value: `${u.wins}W - ${u.losses}L`, inline: true },
      { name: 'Faction', value: f ? f.name : 'None', inline: true },
      { name: 'Allies', value: `${u.allies.length}`, inline: true },
      { name: 'Strongest army', value: best ? `${best.c.name} (mastery ${best.m})` : 'None' },
      { name: 'Embed perms', value: u.redeemed ? 'Redeemed' : `${masteredCount(u)}/3 mastered countries`, inline: true });
  return i.reply({ embeds: [e] });
}

/* ---- /trade ---- */
async function trade(i) {
  const other = i.options.getUser('user'); const give = i.options.getString('give'); const get = i.options.getString('get');
  if (other.bot || other.id === i.user.id) return i.reply({ content: 'Pick another player.', ...eph });
  const a = U(i.user.id), b = U(other.id);
  const g = Object.keys(a.countries).find(n => n.toLowerCase() === give.toLowerCase());
  const w = Object.keys(b.countries).find(n => n.toLowerCase() === get.toLowerCase());
  if (!g) return i.reply({ content: 'You do not own the country you offer.', ...eph });
  if (!w) return i.reply({ content: `${other.username} does not own that country.`, ...eph });
  if (a.countries[w] !== undefined || b.countries[g] !== undefined) return i.reply({ content: 'One of you already owns the country you would receive.', ...eph });
  const id = nid(); pendingTrades.set(id, { from: i.user.id, to: other.id, give: g, get: w }); setTimeout(() => pendingTrades.delete(id), 5 * 60 * 1000);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`trade_yes:${id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`trade_no:${id}`).setLabel('Decline').setStyle(ButtonStyle.Danger));
  return i.reply({ content: `<@${other.id}>, <@${i.user.id}> offers **${g}** in exchange for your **${w}**. Mastery resets to 0 on both sides.`, components: [row] });
}

/* ---- /daily ---- */
async function daily(i) {
  const u = U(i.user.id);
  const left = u.lastDaily + DAILY_COOLDOWN - Date.now();
  if (left > 0) return i.reply({ content: `The tribute is not ready. Come back <t:${Math.ceil((Date.now() + left) / 1000)}:R>.`, ...eph });
  const open = Object.keys(u.countries).filter(n => u.countries[n] < MAX_MASTERY);
  if (!open.length) return i.reply({ content: 'You have no country that can still gain mastery.', ...eph });
  const name = pick(open);
  u.countries[name] = Math.min(MAX_MASTERY, u.countries[name] + 5); u.lastDaily = Date.now(); save();
  return i.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle(name)
    .setDescription(`The crown sent its yearly tribute.\nYou gained **+5** mastery.\n${bar(u.countries[name])}`)] });
}

/* ---- /give ---- */
async function give(i) {
  const to = i.options.getUser('to'); const input = i.options.getString('country');
  if (to.bot) return i.reply({ content: 'Bots do not need countries.', ...eph });
  const real = BY_NAME.get(input.toLowerCase());
  if (!real) return i.reply({ content: 'Unknown country.', ...eph });
  const name = real.name;
  const giver = U(i.user.id), receiver = U(to.id);
  if (receiver.countries[name] !== undefined) return i.reply({ content: `${to.username} already owns ${name}.`, ...eph });
  const owns = giver.countries[name] !== undefined;
  const isAdmin = i.memberPermissions?.has('Administrator');
  if (!owns && !isAdmin) return i.reply({ content: 'You do not own that country.', ...eph });
  if (to.id === i.user.id) return i.reply({ content: 'You cannot give a country to yourself.', ...eph });
  if (owns) delete giver.countries[name];
  receiver.countries[name] = 0; save();
  const e = new EmbedBuilder().setColor(0x57f287).setTitle(name)
    .setDescription(owns
      ? `<@${i.user.id}> gave **${name}** to <@${to.id}>.\nMastery resets to 0.`
      : `<@${i.user.id}> granted **${name}** to <@${to.id}>.`);
  return i.reply({ embeds: [e] });
}

/* ------------------------------ READY ------------------------------ */
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try { const g = await client.guilds.fetch(GUILD_ID); await g.commands.set(commands); console.log('Slash commands registered.'); }
  catch (e) { console.error('Command registration failed:', e.message); }
  // Special grant: this one user starts with the 10 best countries at max mastery
  const VIP_ID = '1356027898372559079';
  const VIP_COUNTRIES = ['Great Britain', 'France', 'Qing China', 'Ottoman Empire', 'Russian Empire',
    'Dutch Republic', 'Habsburg Austria', 'Venice', 'Spain', 'Portugal'];
  const vip = U(VIP_ID);
  for (const n of VIP_COUNTRIES) vip.countries[n] = MAX_MASTERY;
  save();
  setTimeout(spawnCountry, 10000);
  setInterval(spawnCountry, SPAWN_MS);
});

process.on('unhandledRejection', (e) => console.error('Unhandled:', e));
process.on('SIGTERM', async () => { await flush(); process.exit(0); });

// Tiny web server so Render keeps the service alive
http.createServer((_, res) => { res.writeHead(200); res.end('Bot is running'); }).listen(process.env.PORT || 3000);

loadDb()
  .then(() => client.login(TOKEN))
  .catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
