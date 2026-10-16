document.addEventListener('DOMContentLoaded', function() {
    const calcTabs = document.querySelectorAll('.calc-tab');
    const calcContents = document.querySelectorAll('.calc-content');

    calcTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetCalc = this.getAttribute('data-calc');
            
            calcTabs.forEach(t => t.classList.remove('active'));
            calcContents.forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            document.getElementById(targetCalc).classList.add('active');
        });
    });
});

function calculerIS() {
    const ca = parseFloat(document.getElementById('chiffreAffaires').value) || 0;
    const charges = parseFloat(document.getElementById('charges').value) || 0;
    const type = document.getElementById('typeSociete').value;
    
    const resultatAvant = ca - charges;
    const taux = type === 'pme' ? 0.25 : 0.27;
    const montantIS = resultatAvant * taux;
    const resultatNet = resultatAvant - montantIS;
    
    document.getElementById('resultatAvantImpot').textContent = formatCurrency(resultatAvant);
    document.getElementById('tauxIS').textContent = (taux * 100) + '%';
    document.getElementById('montantIS').textContent = formatCurrency(montantIS);
    document.getElementById('resultatNet').textContent = formatCurrency(resultatNet);
}

function calculerEconomies() {
    const nbEmployes = parseInt(document.getElementById('nbEmployes').value) || 1;
    const tempsCompta = parseInt(document.getElementById('tempsCompta').value) || 0;
    const tauxHoraire = parseInt(document.getElementById('tauxHoraire').value) || 0;
    const erreurs = parseInt(document.getElementById('erreurs').value) || 0;
    
    const coutActuel = (tempsCompta * tauxHoraire) + erreurs;
    const gainTemps = (tempsCompta * 0.7 * tauxHoraire);
    const reductionErreurs = erreurs * 0.9;
    const economiesMensuel = gainTemps + reductionErreurs;
    const economiesAnnuel = economiesMensuel * 12;
    const pourcentage = coutActuel > 0 ? Math.round((economiesMensuel / coutActuel) * 100) : 0;
    
    document.getElementById('coutActuel').textContent = formatCurrency(coutActuel);
    document.getElementById('gainTemps').textContent = formatCurrency(gainTemps);
    document.getElementById('reductionErreurs').textContent = formatCurrency(reductionErreurs);
    document.getElementById('economiesMensuel').textContent = formatCurrency(economiesMensuel);
    document.getElementById('economiesAnnuel').textContent = formatCurrency(economiesAnnuel);
    document.getElementById('pourcentageEconomie').textContent = pourcentage;
}

function calculerTVA() {
    const montant = parseFloat(document.getElementById('montantTVA').value) || 0;
    const taux = parseFloat(document.getElementById('tauxTVA').value) / 100;
    const type = document.querySelector('input[name="tvaType"]:checked').value;
    
    let montantHT, montantTVA, montantTTC;
    
    if (type === 'ht') {
        montantHT = montant;
        montantTVA = montant * taux;
        montantTTC = montant + montantTVA;
    } else {
        montantTTC = montant;
        montantHT = montant / (1 + taux);
        montantTVA = montant - montantHT;
    }
    
    document.getElementById('montantHT').textContent = formatCurrency(montantHT);
    document.getElementById('montantTVAResult').textContent = formatCurrency(montantTVA);
    document.getElementById('montantTTC').textContent = formatCurrency(montantTTC);
}

function calculerSalaireNet() {
    const salaireBrut = parseFloat(document.getElementById('salaireBrut').value) || 0;
    const cotisations = salaireBrut * 0.165;
    const salaireNet = salaireBrut - cotisations;
    
    document.getElementById('brut').textContent = formatCurrency(salaireBrut);
    document.getElementById('cotisations').textContent = formatCurrency(cotisations);
    document.getElementById('net').textContent = formatCurrency(salaireNet);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount) + ' FCFA';
}
