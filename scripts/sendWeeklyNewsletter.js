const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { generateNewsletter } = require('./generateNewsletter');
const { sendNewsletter } = require('../lib/emailSender');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const INDEX_FILE = path.join(__dirname, '..', 'data', 'newsletters', 'index.json');

async function getSubscribers() {
    try {
        const result = await pool.query('SELECT * FROM newsletter_subscribers WHERE active = true');
        return result.rows;
    } catch (error) {
        console.error('Error fetching subscribers:', error);
        return [];
    }
}

function getLatestNewsletter() {
    if (!fs.existsSync(INDEX_FILE)) {
        return null;
    }
    const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    if (index.length === 0) return null;
    return index[index.length - 1];
}

function isNewsletterFromThisWeek(newsletter) {
    if (!newsletter) return false;
    const createdAt = new Date(newsletter.createdAt);
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return createdAt > oneWeekAgo;
}

function updateNewsletterStatus(issue, sentCount) {
    const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    const newsletter = index.find(n => n.issue === issue);
    if (newsletter) {
        newsletter.status = 'sent';
        newsletter.sentCount = sentCount;
        newsletter.sentAt = new Date().toISOString();
    }
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

async function runWeeklyNewsletter(forceGenerate = false) {
    console.log('=== Orionexa Weekly Newsletter ===');
    console.log('Started at:', new Date().toISOString());
    
    let newsletter;
    const latestNewsletter = getLatestNewsletter();
    
    if (!forceGenerate && latestNewsletter && isNewsletterFromThisWeek(latestNewsletter)) {
        console.log(`\n1. Using existing newsletter N°${latestNewsletter.issue} (created this week).`);
        newsletter = latestNewsletter;
    } else {
        console.log('\n1. Generating newsletter content...');
        try {
            newsletter = await generateNewsletter();
            console.log(`   Newsletter N°${newsletter.issue} generated.`);
        } catch (error) {
            console.error('   Failed to generate newsletter:', error.message);
            return { success: false, error: 'Newsletter generation failed' };
        }
    }
    
    console.log('\n2. Loading subscribers...');
    const activeSubscribers = await getSubscribers();
    console.log(`   Found ${activeSubscribers.length} active subscribers.`);
    
    if (activeSubscribers.length === 0) {
        console.log('   No active subscribers. Newsletter saved but not sent.');
        return { success: true, newsletter, sent: 0, message: 'No subscribers' };
    }
    
    console.log('\n3. Sending newsletter...');
    const result = await sendNewsletter(newsletter, activeSubscribers);
    
    if (result.success && result.sent > 0) {
        console.log(`   Successfully sent to ${result.sent} subscribers.`);
        if (result.failed > 0) {
            console.log(`   Failed for ${result.failed} subscribers.`);
        }
        updateNewsletterStatus(newsletter.issue, result.sent);
    } else if (result.failed > 0 && result.sent === 0) {
        console.log('   All deliveries failed!');
        return { success: false, newsletter, error: 'All deliveries failed', details: result.errors };
    } else {
        console.log('   Error:', result.error);
    }
    
    console.log('\n=== Newsletter process completed ===');
    return { success: true, newsletter, ...result };
}

async function resendNewsletter(issueNumber) {
    console.log(`=== Resending Newsletter N°${issueNumber} ===`);
    
    if (!fs.existsSync(INDEX_FILE)) {
        return { success: false, error: 'No newsletters found' };
    }
    
    const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    const newsletter = index.find(n => n.issue === issueNumber);
    
    if (!newsletter) {
        return { success: false, error: `Newsletter N°${issueNumber} not found` };
    }
    
    const activeSubscribers = await getSubscribers();
    
    if (activeSubscribers.length === 0) {
        return { success: false, error: 'No active subscribers' };
    }
    
    const result = await sendNewsletter(newsletter, activeSubscribers);
    
    if (result.success && result.sent > 0) {
        updateNewsletterStatus(newsletter.issue, result.sent);
    }
    
    return { success: result.sent > 0, newsletter, ...result };
}

module.exports = { runWeeklyNewsletter, resendNewsletter, getLatestNewsletter };

if (require.main === module) {
    runWeeklyNewsletter()
        .then(result => {
            console.log('\nResult:', JSON.stringify(result, null, 2));
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Error:', error);
            process.exit(1);
        });
}
