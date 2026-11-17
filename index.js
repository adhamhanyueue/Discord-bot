const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ================= الإعدادات =================
const TOKEN = 'const TOKEN = process.env.TOKEN;
';
const PREFIX = '!';
const COOLDOWN_SECONDS = 15; // وقت الانتظار بين كل رسالة تكسب منها عملات
const MIN_COINS = 5;         // أقل عدد عملات للرسالة
const MAX_COINS = 15;        // أكثر عدد عملات للرسالة

// متجر الرتب (عدّل الأسماء والأسعار وأرقام الـ ID)
const SHOP_ROLES = [
    { id: '111111111111111111', name: 'VIP', price: 100 },
    { id: '222222222222222222', name: 'Super VIP', price: 300 },
    { id: '333333333333333333', name: 'Legend', price: 500 }
];
// =============================================

const DB_FILE = './database.json';
const cooldowns = new Map();

// دالة لقراءة قاعدة البيانات
function getDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// دالة لحفظ البيانات
function saveDatabase(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

client.once('ready', () => {
    console.log(`✅ تم تسجيل الدخول باسم ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const db = getDatabase();
    const userId = message.author.id;

    if (!db[userId]) {
        db[userId] = { coins: 0 };
    }

    // 1. نظام كسب العملات من التفاعل (الرسائل)
    if (!message.content.startsWith(PREFIX)) {
        const now = Date.now();
        const lastMessageTime = cooldowns.get(userId) || 0;

        if (now - lastMessageTime >= COOLDOWN_SECONDS * 1000) {
            const earned = Math.floor(Math.random() * (MAX_COINS - MIN_COINS + 1)) + MIN_COINS;
            db[userId].coins += earned;
            saveDatabase(db);
            cooldowns.set(userId, now);
        }
        return;
    }

    // 2. معالجة الأوامر
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // أمر معرفة الرصيد: !coins أو !رصيدي
    if (command === 'coins' || command === 'رصيدي') {
        const target = message.mentions.users.first() || message.author;
        const balance = db[target.id]?.coins || 0;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setDescription(`💰 رصيد **${target.username}** الحالي هو: **${balance}** عملة.`);
        return message.reply({ embeds: [embed] });
    }

    // أمر عرض المتجر: !shop أو !متجر
    if (command === 'shop' || command === 'متجر') {
        const embed = new EmbedBuilder()
            .setTitle('🛒 متجر الرتب')
            .setColor('#00AE86')
            .setDescription('استخدم أمر `!buy رقم_الرتبة` لشراء الرتبة.\n\n' +
                SHOP_ROLES.map((role, index) => 
                    `**${index + 1}.** <@&${role.id}> — السعر: **${role.price}** عملة`
                ).join('\n')
            );
        return message.channel.send({ embeds: [embed] });
    }

    // أمر الشراء: !buy 1 أو !شراء 1
    if (command === 'buy' || command === 'شراء') {
        const itemIndex = parseInt(args[0]) - 1;
        const selectedRole = SHOP_ROLES[itemIndex];

        if (!selectedRole) {
            return message.reply('❌ رقم الرتبة غير صحيح. اكتب `!shop` لرؤية الأرقام المتاحة.');
        }

        if (db[userId].coins < selectedRole.price) {
            return message.reply(`❌ رصيدك لا يكفي. تحتاج إلى **${selectedRole.price}** عملة.`);
        }

        const role = message.guild.roles.cache.get(selectedRole.id);
        if (!role) {
            return message.reply('❌ هذه الرتبة غير موجودة في السيرفر. تواصل مع الإدارة.');
        }

        if (message.member.roles.cache.has(role.id)) {
            return message.reply('⚠️ أنت تمتلك هذه الرتبة بالفعل.');
        }

        try {
            await message.member.roles.add(role);
            db[userId].coins -= selectedRole.price;
            saveDatabase(db);

            return message.reply(`🎉 مبروك! تم شراء رتبة **${role.name}** بنجاح وخصم **${selectedRole.price}** عملة.`);
        } catch (error) {
            console.error(error);
            return message.reply('❌ حدث خطأ أثناء إعطاء الرتبة. تأكد أن رتبة البوت أعلى من هذه الرتبة.');
        }
    }

    // أمر إداري لإعطاء عملات: !addcoins @user 100
    if (command === 'addcoins') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('❌ هذا الأمر للإدارة فقط.');
        }

        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount)) {
            return message.reply('⚠️ الاستخدام الصحيح: `!addcoins @user 100`');
        }

        if (!db[target.id]) db[target.id] = { coins: 0 };
        db[target.id].coins += amount;
        saveDatabase(db);

        return message.reply(`✅ تم إضافة **${amount}** عملة إلى رصيد **${target.username}**.`);
    }
});

client.login(TOKEN);
      
