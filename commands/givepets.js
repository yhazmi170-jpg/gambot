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
  // === 100 NEW SPECIES ===
  // COMMON (20)
  { species: 'Pigeon', rarity: 'COMMON' },
  { species: 'Sparrow', rarity: 'COMMON' },
  { species: 'Seagull', rarity: 'COMMON' },
  { species: 'Raven', rarity: 'COMMON' },
  { species: 'Crow', rarity: 'COMMON' },
  { species: 'Moth', rarity: 'COMMON' },
  { species: 'Beetle', rarity: 'COMMON' },
  { species: 'Ant', rarity: 'COMMON' },
  { species: 'Ladybug', rarity: 'COMMON' },
  { species: 'Cricket', rarity: 'COMMON' },
  { species: 'Worm', rarity: 'COMMON' },
  { species: 'Snail', rarity: 'COMMON' },
  { species: 'Slug', rarity: 'COMMON' },
  { species: 'Shrimp', rarity: 'COMMON' },
  { species: 'Crab', rarity: 'COMMON' },
  { species: 'Lobster', rarity: 'COMMON' },
  { species: 'Starfish', rarity: 'COMMON' },
  { species: 'Seahorse', rarity: 'COMMON' },
  { species: 'Clownfish', rarity: 'COMMON' },
  { species: 'Pufferfish', rarity: 'COMMON' },
  // UNCOMMON (20)
  { species: 'Flamingo', rarity: 'UNCOMMON' },
  { species: 'Peacock', rarity: 'UNCOMMON' },
  { species: 'Swan', rarity: 'UNCOMMON' },
  { species: 'Pelican', rarity: 'UNCOMMON' },
  { species: 'Toucan', rarity: 'UNCOMMON' },
  { species: 'Hummingbird', rarity: 'UNCOMMON' },
  { species: 'Parakeet', rarity: 'UNCOMMON' },
  { species: 'Cockatoo', rarity: 'UNCOMMON' },
  { species: 'Macaw', rarity: 'UNCOMMON' },
  { species: 'Penguin', rarity: 'UNCOMMON' },
  { species: 'Seal', rarity: 'UNCOMMON' },
  { species: 'Walrus', rarity: 'UNCOMMON' },
  { species: 'Manatee', rarity: 'UNCOMMON' },
  { species: 'Narwhal', rarity: 'UNCOMMON' },
  { species: 'Barracuda', rarity: 'UNCOMMON' },
  { species: 'Swordfish', rarity: 'UNCOMMON' },
  { species: 'Manta Ray', rarity: 'UNCOMMON' },
  { species: 'Jellyfish', rarity: 'UNCOMMON' },
  { species: 'Coral', rarity: 'UNCOMMON' },
  { species: 'Sea Urchin', rarity: 'UNCOMMON' },
  // RARE (20)
  { species: 'Mammoth', rarity: 'RARE' },
  { species: 'Sabertooth', rarity: 'RARE' },
  { species: 'Dodo', rarity: 'RARE' },
  { species: 'Moa', rarity: 'RARE' },
  { species: 'Elephant Bird', rarity: 'RARE' },
  { species: 'Roc', rarity: 'RARE' },
  { species: 'Basilisk', rarity: 'RARE' },
  { species: 'Cockatrice', rarity: 'RARE' },
  { species: 'Manticore', rarity: 'RARE' },
  { species: 'Wyvern', rarity: 'RARE' },
  { species: 'Ryu', rarity: 'RARE' },
  { species: 'Chimera', rarity: 'RARE' },
  { species: 'Nemean Lion', rarity: 'RARE' },
  { species: 'Lernaean Hydra', rarity: 'RARE' },
  { species: 'Calydonian Boar', rarity: 'RARE' },
  { species: 'Peryton', rarity: 'RARE' },
  { species: 'Karkadann', rarity: 'RARE' },
  { species: 'Catoblepas', rarity: 'RARE' },
  { species: 'Leucrocotta', rarity: 'RARE' },
  { species: 'Marelion', rarity: 'RARE' },
  // EPIC (20)
  { species: 'Fafnir', rarity: 'EPIC' },
  { species: 'Nidhogg', rarity: 'EPIC' },
  { species: 'Jormungandr', rarity: 'EPIC' },
  { species: 'Fenrir', rarity: 'EPIC' },
  { species: 'Garmr', rarity: 'EPIC' },
  { species: 'Ratatoskr', rarity: 'EPIC' },
  { species: 'Vera', rarity: 'EPIC' },
  { species: 'Hraesvelgr', rarity: 'EPIC' },
  { species: 'Níðhöggr', rarity: 'EPIC' },
  { species: 'Gullinbursti', rarity: 'EPIC' },
  { species: 'Sleipnir', rarity: 'EPIC' },
  { species: 'Hildisvíni', rarity: 'EPIC' },
  { species: 'Geri', rarity: 'EPIC' },
  { species: 'Freki', rarity: 'EPIC' },
  { species: 'Huginn', rarity: 'EPIC' },
  { species: 'Muninn', rarity: 'EPIC' },
  { species: 'Geri', rarity: 'EPIC' },
  { species: 'Skoll', rarity: 'EPIC' },
  { species: 'Hati', rarity: 'EPIC' },
  { species: 'Managarm', rarity: 'EPIC' },
  // LEGENDARY (15)
  { species: 'Behemoth', rarity: 'LEGENDARY' },
  { species: 'Ziz', rarity: 'LEGENDARY' },
  { species: 'Leviathan', rarity: 'LEGENDARY' },
  { species: 'Asura', rarity: 'LEGENDARY' },
  { species: 'Rakshasa', rarity: 'LEGENDARY' },
  { species: 'Ifrit', rarity: 'LEGENDARY' },
  { species: 'Marid', rarity: 'LEGENDARY' },
  { species: 'Dao', rarity: 'LEGENDARY' },
  { species: 'Jinn', rarity: 'LEGENDARY' },
  { species: 'Ghoul', rarity: 'LEGENDARY' },
  { species: 'Ifrit', rarity: 'LEGENDARY' },
  { species: 'Pazuzu', rarity: 'LEGENDARY' },
  { species: 'Humatsu', rarity: 'LEGENDARY' },
  { species: 'Vetala', rarity: 'LEGENDARY' },
  { species: 'Yuki-onna', rarity: 'LEGENDARY' },
  // MYTHIC (5)
  { species: 'Quetzalcoatl', rarity: 'MYTHIC' },
  { species: 'Tezcatlipoca', rarity: 'MYTHIC' },
  { species: 'Huitzilopochtli', rarity: 'MYTHIC' },
  { species: 'Tlaloc', rarity: 'MYTHIC' },
  { species: 'Xbalanque', rarity: 'MYTHIC' },
  // SECRET PETS (ultra-rare, special)
  { species: 'Golden Unicorn', rarity: 'SECRET' },
  { species: 'Diamond Dragon', rarity: 'SECRET' },
  { species: 'Rainbow Phoenix', rarity: 'SECRET' },
  { species: 'Shadow Fenrir', rarity: 'SECRET' },
  { species: 'Celestial Kirin', rarity: 'SECRET' },
  { species: 'Abyssal Kraken', rarity: 'SECRET' },
  { species: 'Eclipse Odin', rarity: 'SECRET' },
  { species: 'Void Cthulhu', rarity: 'SECRET' },
  { species: 'Storm Thunderbird', rarity: 'SECRET' },
  { species: 'Frost Jormungandr', rarity: 'SECRET' },
  { species: 'Inferno Ifrit', rarity: 'SECRET' },
  { species: 'Emerald Leviathan', rarity: 'SECRET' },
  { species: 'Crimson Griffin', rarity: 'SECRET' },
  { species: 'Spectral Anubis', rarity: 'SECRET' },
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
