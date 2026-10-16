async function searchNews(query) {
    if (!process.env.SERPER_API_KEY) {
        console.warn('SERPER_API_KEY not configured, skipping news search');
        return [];
    }

    try {
        const response = await fetch('https://google.serper.dev/news', {
            method: 'POST',
            headers: {
                'X-API-KEY': process.env.SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: query,
                gl: 'tg',
                hl: 'fr',
                num: 10
            })
        });

        if (!response.ok) {
            console.error('Serper API error:', response.status);
            return [];
        }

        const data = await response.json();
        return data.news || [];
    } catch (error) {
        console.error('Error fetching news:', error.message);
        return [];
    }
}

async function getTogoEconomicNews() {
    const queries = [
        'Togo économie actualité',
        'CEDEAO commerce Afrique Ouest',
        'fiscalité entreprise Togo 2024'
    ];

    const allNews = [];
    
    for (const query of queries) {
        const news = await searchNews(query);
        allNews.push(...news);
    }

    const uniqueNews = allNews.filter((item, index, self) =>
        index === self.findIndex(n => n.title === item.title)
    );

    return uniqueNews.slice(0, 15);
}

function formatNewsForPrompt(newsItems) {
    if (!newsItems || newsItems.length === 0) {
        return 'Aucune actualité récente trouvée.';
    }

    return newsItems.map((item, i) => 
        `${i + 1}. ${item.title}\n   Source: ${item.source}\n   Date: ${item.date || 'Récent'}\n   Résumé: ${item.snippet || ''}`
    ).join('\n\n');
}

module.exports = { searchNews, getTogoEconomicNews, formatNewsForPrompt };
