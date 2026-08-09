const db = require('../db');
const { embed, error, success } = require('../utils/embed');

const ALL_SPECIES = [
  // COMMON
  { species: 'Fish', rarity: 'COMMON' },
  { species: 'Frog', rarity: 'COMMON' },
  { species: 'Rabbit', rarity: 'COMMON' },
  { species: 'Mouse', rarity: 'COMMON' },
  { species: 'Snake', rarity: 'COMMON' },
  { species: 'Turtle', rarity: 'COMMON' },
  { species: 'Chicken', rarity: 'COMMON' },
  { species: 'Pig', rarity: 'COMMON' },
  { species: 'Duck', rarity: 'COMMON' },
  { species: 'Koala', rarity: 'COMMON' },
  { species: 'Penguin', rarity: 'COMMON' },
  { species: 'Capybara', rarity: 'COMMON' },
  { species: 'Falcon', rarity: 'COMMON' },
  { species: 'Octopus', rarity: 'COMMON' },
  { species: 'Monkey', rarity: 'COMMON' },
  { species: 'Crocodile', rarity: 'COMMON' },
  { species: 'Bee', rarity: 'COMMON' },
  { species: 'Butterfly', rarity: 'COMMON' },
  { species: 'Deer', rarity: 'COMMON' },
  { species: 'Skunk', rarity: 'COMMON' },
  // UNCOMMON
  { species: 'Parrot', rarity: 'UNCOMMON' },
  { species: 'Raccoon', rarity: 'UNCOMMON' },
  { species: 'Ferret', rarity: 'UNCOMMON' },
  { species: 'Puffin', rarity: 'UNCOMMON' },
  { species: 'Shark', rarity: 'UNCOMMON' },
  { species: 'Dolphin', rarity: 'UNCOMMON' },
  { species: 'Whale', rarity: 'UNCOMMON' },
  { species: 'Wolf', rarity: 'UNCOMMON' },
  { species: 'Boar', rarity: 'UNCOMMON' },
  { species: 'Eagle', rarity: 'UNCOMMON' },
  { species: 'Crow', rarity: 'UNCOMMON' },
  { species: 'Owl', rarity: 'UNCOMMON' },
  { species: 'Fox', rarity: 'UNCOMMON' },
  { species: 'Jaguar', rarity: 'UNCOMMON' },
  { species: 'Otter', rarity: 'UNCOMMON' },
  { species: 'Moose', rarity: 'UNCOMMON' },
  { species: 'Hawk', rarity: 'UNCOMMON' },
  { species: 'Lynx', rarity: 'UNCOMMON' },
  { species: 'Cobra', rarity: 'UNCOMMON' },
  { species: 'Scorpion', rarity: 'UNCOMMON' },
  // RARE
  { species: 'Tiger', rarity: 'RARE' },
  { species: 'Lion', rarity: 'RARE' },
  { species: 'Elephant', rarity: 'RARE' },
  { species: 'Gorilla', rarity: 'RARE' },
  { species: 'Rhino', rarity: 'RARE' },
  { species: 'Hippo', rarity: 'RARE' },
  { species: 'Panda', rarity: 'RARE' },
  { species: 'Kraken', rarity: 'RARE' },
  { species: 'Griffin', rarity: 'RARE' },
  { species: 'Phoenix', rarity: 'RARE' },
  { species: 'Dragon', rarity: 'RARE' },
  { species: 'Unicorn', rarity: 'RARE' },
  { species: 'Mermaid', rarity: 'RARE' },
  { species: 'Minotaur', rarity: 'RARE' },
  { species: 'Centaur', rarity: 'RARE' },
  { species: 'Sphinx', rarity: 'RARE' },
  { species: 'Werewolf', rarity: 'RARE' },
  { species: 'Thunderbird', rarity: 'RARE' },
  { species: 'Leviathan', rarity: 'RARE' },
  { species: 'Jormungandr', rarity: 'RARE' },
  // EPIC
  { species: 'Cerberus', rarity: 'EPIC' },
  { species: 'Medusa', rarity: 'EPIC' },
  { species: 'Chimera', rarity: 'EPIC' },
  { species: 'Hydra', rarity: 'EPIC' },
  { species: 'Pegasus', rarity: 'EPIC' },
  { species: 'Fenrir', rarity: 'EPIC' },
  { species: 'Quetzalcoatl', rarity: 'EPIC' },
  { species: 'Kirin', rarity: 'EPIC' },
  { species: 'Yeti', rarity: 'EPIC' },
  { species: 'Bigfoot', rarity: 'EPIC' },
  { species: 'Mothman', rarity: 'EPIC' },
  { species: 'Jersey Devil', rarity: 'EPIC' },
  { species: 'Kappa', rarity: 'EPIC' },
  { species: 'Tengu', rarity: 'EPIC' },
  // LEGENDARY
  { species: 'Odin', rarity: 'LEGENDARY' },
  { species: 'Zeus', rarity: 'LEGENDARY' },
  { species: 'Thor', rarity: 'LEGENDARY' },
  { species: 'Anubis', rarity: 'LEGENDARY' },
  { species: 'Ra', rarity: 'LEGENDARY' },
  { species: 'Poseidon', rarity: 'LEGENDARY' },
  { species: 'Hades', rarity: 'LEGENDARY' },
  { species: 'Quetzal', rarity: 'LEGENDARY' },
  { species: 'Typhon', rarity: 'LEGENDARY' },
  { species: 'Tiamat', rarity: 'LEGENDARY' },
  { species: 'Bahamut', rarity: 'LEGENDARY' },
  { species: 'Cthulhu', rarity: 'LEGENDARY' },
  { species: 'Godzilla', rarity: 'LEGENDARY' },
  { species: 'King Kong', rarity: 'LEGENDARY' },
  // MYTHIC
  { species: 'Amaterasu', rarity: 'MYTHIC' },
  { species: 'Susanoo', rarity: 'MYTHIC' },
  { species: 'Tsukuyomi', rarity: 'MYTHIC' },
  { species: 'Izanagi', rarity: 'MYTHIC' },
  { species: 'Chronos', rarity: 'MYTHIC' },
  { species: 'Gaia', rarity: 'MYTHIC' },
  { species: 'Uranus', rarity: 'MYTHIC' },
  { species: 'Nemesis', rarity: 'MYTHIC' },
  { species: 'Erebus', rarity: 'MYTHIC' },
  { species: 'Nyx', rarity: 'MYTHIC' },
];

const TRAITS = ['Brave', 'Chill', 'Eager', 'Lucky', 'Calm'];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  name: 'givepets',
  helpCategory: 'Admin',
  aliases: ['giveall', 'spawnpets'],
  description: 'give a user every pet species (owner only)',
  execute(message, args) {
    if (message.author.id !== require('../config').ownerId) {
      return message.channel.send({ embeds: [error('owner only')] });
    }

    const target = message.mentions.users.first();
    if (!target) return message.channel.send({ embeds: [error('mention a user — e.g. `v givepets @nina`')] });

    try {
      let count = 0;
      let maxId = db.exec('SELECT MAX(id) FROM animals');
      let nextId = (maxId[0]?.values[0][0] || 0) + 1;

      for (const sp of ALL_SPECIES) {
        const hp = rand(80, 400);
        const atk = rand(8, 80);
        const def = rand(5, 60);
        const shiny = Math.random() < 0.1 ? 1 : 0;
        const trait = TRAITS[Math.floor(Math.random() * TRAITS.length)];

        db.exec(`INSERT INTO animals (id, user_id, species, rarity, name, level, exp, hp, max_hp, attack, defense, created_at, shiny, trait, fed_until) VALUES (${nextId}, '${target.id}', '${sp.species}', '${sp.rarity}', '${sp.species}', 1, 0, ${hp}, ${hp}, ${atk}, ${def}, ${Date.now()}, ${shiny}, '${trait}', 0)`);
        nextId++;
        count++;
      }

      return message.channel.send({ embeds: [success(`gave **${count}** pets to <@${target.id}> — one of every species including mythics 🐾`)] });
    } catch (err) {
      console.error('givepets error:', err);
      return message.channel.send({ embeds: [error(`error: ${err.message}`)] });
    }
  },
};
