const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, Collection } = require("discord.js");
const config = require("./config.json");
const chalk = require("chalk");

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

client.commands = new Collection();

const commands = [
    new SlashCommandBuilder()
        .setName("giv")
        .setDescription("Lance un giveaway")
        .addStringOption(option =>
            option.setName("prix")
                .setDescription("Le prix du giveaway")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("durée")
                .setDescription("Durée (ex: 1h, 30m, 2j)")
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName("gagnants")
                .setDescription("Nombre de gagnants")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("image")
                .setDescription("Lien d'une image ou GIF")
                .setRequired(false))
].map(command => command.toJSON());

client.once("ready", async () => {
    console.log(chalk.green(`✅ Connecté en tant que ${client.user.tag}`));

    const rest = new REST({ version: "10" }).setToken(config.token);

    try {
        console.log(chalk.yellow("🔄 Enregistrement des commandes..."));
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands }
        );
        console.log(chalk.green("✅ Commandes enregistrées avec succès !"));

        // <-- AJOUTER ICI -->
        // Mettre à jour le statut du bot en STREAMING
        client.user.setPresence({
            activities: [{
                name: "Giveaway en cours !",   // Message affiché en tant que titre du stream
                type: "STREAMING",             // Le type d'activité
                url: "https://www.twitch.tv/night" // Lien du stream (peut être un lien Twitch)
            }],
            status: "online"                   // Statut en ligne
        });

    } catch (error) {
        console.error(chalk.red("❌ Erreur lors de l'enregistrement des commandes :"), error);
    }
});


client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "giv") {
        try {
            const prize = interaction.options.getString("prix");
            const duration = interaction.options.getString("durée");
            const winnersCount = interaction.options.getInteger("gagnants");
            const image = interaction.options.getString("image");

            const durationMs = parseDuration(duration);
            if (!durationMs) {
                return interaction.reply({ content: "⏳ Format de durée invalide. Ex: 1h, 30m, 2j", ephemeral: true });
            }

            const emojis = interaction.guild.emojis.cache;
            const emojiArray = Array.from(emojis.values());
            const randomEmoji = emojiArray.length > 0 ? emojiArray[Math.floor(Math.random() * emojiArray.length)].toString() : "🎉";

            const embed = new EmbedBuilder()
                .setTitle(`🎉 Giveaway: ${prize}`)
                .setDescription(`Réagissez avec ${randomEmoji} pour participer !\n\n*Nombre de gagnants:* **${winnersCount}**\n\n*Fin du giveaway:* **${duration}**`)
                .setColor(0x000000)
                .setImage(image || null)
                .setFooter({ text: "Bonne chance à tous !" });

            const replyMessage = await interaction.reply({ embeds: [embed], fetchReply: true });
            await replyMessage.react(randomEmoji);

            const filter = (reaction, user) => {
                return !user.bot && reaction.emoji.toString() === randomEmoji;
            };

            const collector = replyMessage.createReactionCollector({ filter, time: durationMs });
            const participants = new Set();

            collector.on('collect', async (reaction, user) => {
                if (reaction.partial) {
                    try {
                        await reaction.fetch();
                    } catch (error) {
                        console.error("Erreur lors de la récupération de la réaction :", error);
                        return;
                    }
                }
                console.log(`Réaction collectée de ${user.tag} avec l'emoji :`, reaction.emoji.name);
                participants.add(user.id);
            });

            collector.on('end', () => {
                console.log(`Collector terminé. Nombre de participants: ${participants.size}`);
                if (participants.size === 0) {
                    return interaction.followUp("❌ Aucun participant, giveaway annulé !");
                }

                const winners = Array.from(participants)
                    .sort(() => Math.random() - 0.5)
                    .slice(0, winnersCount);

                const winnerMentions = winners.map(id => `<@${id}>`).join(", ");
                interaction.followUp(`🎊 Félicitations ${winnerMentions}, vous avez gagné **${prize}** ! 🎁`);
            });
        } catch (error) {
            console.error(chalk.red("❌ Erreur dans la gestion du giveaway :"), error);
            if (!interaction.replied) {
                interaction.reply({ content: "❌ Une erreur s'est produite, réessaie plus tard.", ephemeral: true });
            } else {
                interaction.followUp({ content: "❌ Une erreur s'est produite, réessaie plus tard.", ephemeral: true });
            }
        }
    }
});

function parseDuration(duration) {
    const match = duration.match(/(\d+)([smhd])/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[unit] || 0);
}

client.login(config.token);

// Essaie ce code et dis-moi si ça fonctionne bien pour toi ! 🚀