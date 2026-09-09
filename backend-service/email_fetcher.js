require('dotenv').config();
const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;
const fs = require('fs');
const path = require('path');

const config = {
    imap: {
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASSWORD,
        host: process.env.IMAP_HOST || 'imap-mail.outlook.com',
        port: process.env.IMAP_PORT || 993,
        tls: true,
        authTimeout: 3000
    }
};

async function fetchEmailsAndDownloadPDFs() {
    try {
        const connection = await imaps.connect(config);
        console.log('Terhubung ke IMAP Server.');
        
        await connection.openBox('INBOX');
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = {
            bodies: ['HEADER', 'TEXT', ''],
            markSeen: true
        };

        const messages = await connection.search(searchCriteria, fetchOptions);
        console.log(`Ditemukan ${messages.length} email baru.`);

        for (const message of messages) {
            const all = message.parts.find(part => part.which === '');
            const id = message.attributes.uid;
            const idHeader = "Imap-Id: "+id+"\r\n";

            const mail = await simpleParser(idHeader + all.body);
            
            console.log(`\nEmail dari: ${mail.from.text}`);
            console.log(`Subjek: ${mail.subject}`);

            if (mail.attachments && mail.attachments.length > 0) {
                mail.attachments.forEach(attachment => {
                    if (attachment.contentType === 'application/pdf') {
                        const filename = `${Date.now()}_${attachment.filename}`;
                        const filepath = path.join(__dirname, 'temp', 'attachments', filename);
                        fs.writeFileSync(filepath, attachment.content);
                        console.log(`Berhasil mengunduh PDF: ${filename}`);
                    }
                });
            } else {
                console.log('Tidak ada lampiran PDF.');
            }
        }

        connection.end();
        console.log('Selesai memproses email.');

    } catch (err) {
        console.error('Error IMAP:', err);
    }
}

// Hanya dijalankan jika dipanggil langsung
if (require.main === module) {
    fetchEmailsAndDownloadPDFs();
}

module.exports = { fetchEmailsAndDownloadPDFs };
