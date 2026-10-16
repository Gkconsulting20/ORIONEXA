const Brevo = require('@getbrevo/brevo');
const fs = require('fs');
const path = require('path');

const apiInstance = new Brevo.TransactionalEmailsApi();
const apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_API_KEY;

async function sendNewsletter(newsletter, subscribers) {
    if (!process.env.BREVO_API_KEY) {
        console.error('BREVO_API_KEY not configured');
        return { success: false, error: 'BREVO_API_KEY not configured' };
    }

    const newsletterPath = path.join(__dirname, '..', 'data', 'newsletters', newsletter.filePath);
    const htmlContent = fs.readFileSync(newsletterPath, 'utf8');
    
    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const subscriber of subscribers) {
        if (!subscriber.active) continue;
        
        const personalizedContent = htmlContent.replace(
            '<div class="content">',
            `<div class="content"><p style="margin-bottom: 20px; color: #666;">Bonjour <strong>${subscriber.prenom || 'Cher abonné'}</strong>,</p>`
        );

        const sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.subject = newsletter.subject;
        sendSmtpEmail.htmlContent = personalizedContent;
        sendSmtpEmail.sender = { name: 'Orionexa', email: 'gkconsulting20@gmail.com' };
        sendSmtpEmail.to = [{ email: subscriber.email, name: `${subscriber.prenom || ''} ${subscriber.nom || ''}`.trim() }];
        sendSmtpEmail.replyTo = { email: 'contact@orionexa.com', name: 'Orionexa' };

        try {
            await apiInstance.sendTransacEmail(sendSmtpEmail);
            successCount++;
            console.log(`Email sent to: ${subscriber.email}`);
        } catch (error) {
            failedCount++;
            errors.push({ email: subscriber.email, error: error.message });
            console.error(`Failed to send to ${subscriber.email}:`, error.message);
        }
    }

    const allFailed = successCount === 0 && failedCount > 0;
    return {
        success: !allFailed,
        sent: successCount,
        failed: failedCount,
        errors
    };
}

async function testEmailConnection() {
    if (!process.env.BREVO_API_KEY) {
        return { success: false, message: 'BREVO_API_KEY not configured' };
    }

    try {
        const accountApi = new Brevo.AccountApi();
        accountApi.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY;
        const data = await accountApi.getAccount();
        return { success: true, message: `Connected as: ${data.email}` };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = { sendNewsletter, testEmailConnection };
