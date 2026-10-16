const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { getTogoEconomicNews, formatNewsForPrompt } = require('../lib/newsSearch');

const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});

const DATA_DIR = path.join(__dirname, '..', 'data', 'newsletters');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

function getNextIssueNumber() {
    if (!fs.existsSync(INDEX_FILE)) {
        return 1;
    }
    const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    return index.length + 1;
}

function saveNewsletterIndex(newsletter) {
    let index = [];
    if (fs.existsSync(INDEX_FILE)) {
        index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    }
    index.push(newsletter);
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

function getCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return now.toLocaleDateString('fr-FR', options);
}

function getWeekNumber() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
}

async function generateNewsletterContent(issueNumber) {
    const currentDate = getCurrentDate();
    const weekNumber = getWeekNumber();
    const year = new Date().getFullYear();
    
    console.log('   Fetching latest news from Serper...');
    const newsItems = await getTogoEconomicNews();
    const newsContext = formatNewsForPrompt(newsItems);
    console.log(`   Found ${newsItems.length} news articles.`);
    
    const prompt = `Tu es un expert économique spécialisé dans l'économie du Togo et de la zone CEDEAO.

Génère le contenu de la Newsletter Orionexa N°${issueNumber} pour la semaine ${weekNumber} de ${year}.

ACTUALITÉS RÉCENTES À UTILISER (sources réelles) :
${newsContext}

En te basant sur ces actualités récentes, rédige une newsletter professionnelle contenant :

1. **ÉDITORIAL** (2-3 phrases d'introduction sur le climat économique actuel basé sur les actualités)

2. **ACTUALITÉS ÉCONOMIQUES DU TOGO** (3-4 points basés sur les vraies actualités ci-dessus)
   - Cite les sources quand c'est pertinent
   - Résume les informations clés pour les entrepreneurs

3. **ACTUALITÉS DE LA CEDEAO** (2-3 points si disponible dans les actualités)
   - Échanges commerciaux régionaux
   - Intégration économique

4. **FOCUS FISCAL ET COMPTABLE** (2-3 points)
   - Rappels d'échéances fiscales importantes au Togo
   - Conseils pratiques pour les entreprises

5. **CONSEIL DE LA SEMAINE**
   - Un conseil pratique basé sur l'actualité

6. **CHIFFRE CLÉ DE LA SEMAINE**
   - Une statistique tirée des actualités avec son contexte

Format le contenu en HTML avec des balises appropriées (h2, h3, p, ul, li, strong).
Utilise un ton professionnel mais accessible.
Ne mentionne pas "selon les actualités fournies" - présente les infos naturellement.`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Tu es un rédacteur économique expert de l\'Afrique de l\'Ouest. Tu rédiges des newsletters basées sur des actualités réelles et récentes.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 2500,
            temperature: 0.7
        });

        let content = response.choices[0].message.content;
        content = content.replace(/```html\n?/g, '').replace(/```\n?/g, '');
        content = content.replace(/<!DOCTYPE html>[\s\S]*?<body>/g, '');
        content = content.replace(/<\/body>[\s\S]*?<\/html>/g, '');
        return content.trim();
    } catch (error) {
        console.error('Error generating newsletter content:', error);
        throw error;
    }
}

function generateNewsletterHTML(issueNumber, content, date) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Newsletter Orionexa N°${issueNumber}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1a252f 0%, #2c3e50 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { margin: 0; font-size: 28px; }
        .header .issue { color: #3498db; font-size: 16px; margin-top: 10px; }
        .header .date { color: #bdc3c7; font-size: 14px; margin-top: 5px; }
        .content { background: #fff; padding: 30px; border: 1px solid #e8e8e8; }
        h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-top: 25px; }
        h3 { color: #3498db; }
        ul { padding-left: 20px; }
        li { margin-bottom: 10px; }
        .highlight { background: #f8f9fa; padding: 15px; border-left: 4px solid #e74c3c; margin: 20px 0; border-radius: 5px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 14px; color: #666; }
        .footer a { color: #3498db; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Newsletter Orionexa</h1>
        <div class="issue">N°${issueNumber} - Actualité Économique Hebdomadaire</div>
        <div class="date">${date}</div>
    </div>
    <div class="content">
        ${content}
    </div>
    <div class="footer">
        <p><strong>Orionexa</strong> - La gestion moderne, sans limites.</p>
        <p>Comptabilité • Fiscalité • Digitalisation • Formation</p>
        <p><a href="https://orionexa.com">www.orionexa.com</a> | contact@orionexa.com</p>
        <p style="font-size: 12px; color: #999;">Pour vous désinscrire, <a href="#">cliquez ici</a></p>
    </div>
</body>
</html>`;
}

async function generateNewsletter() {
    console.log('Starting newsletter generation...');
    
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    const issueNumber = getNextIssueNumber();
    const currentDate = getCurrentDate();
    
    console.log(`Generating Newsletter N°${issueNumber}...`);
    
    const content = await generateNewsletterContent(issueNumber);
    const htmlContent = generateNewsletterHTML(issueNumber, content, currentDate);
    
    const fileName = `newsletter-${issueNumber}.html`;
    const filePath = path.join(DATA_DIR, fileName);
    
    fs.writeFileSync(filePath, htmlContent);
    
    const newsletterRecord = {
        issue: issueNumber,
        subject: `Newsletter Orionexa N°${issueNumber} - Actualité Économique`,
        createdAt: new Date().toISOString(),
        date: currentDate,
        filePath: fileName,
        status: 'generated',
        sentCount: 0
    };
    
    saveNewsletterIndex(newsletterRecord);
    
    console.log(`Newsletter N°${issueNumber} generated successfully!`);
    console.log(`File saved: ${filePath}`);
    
    return newsletterRecord;
}

module.exports = { generateNewsletter, getNextIssueNumber };

if (require.main === module) {
    generateNewsletter()
        .then(result => {
            console.log('Newsletter created:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Error:', error);
            process.exit(1);
        });
}
