document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                message: document.getElementById('message').value
            };

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                const messageDiv = document.getElementById('formMessage');
                
                if (result.success) {
                    messageDiv.className = 'form-message success';
                    messageDiv.textContent = result.message;
                    contactForm.reset();
                } else {
                    messageDiv.className = 'form-message error';
                    messageDiv.textContent = 'Une erreur est survenue. Veuillez réessayer.';
                }
            } catch (error) {
                const messageDiv = document.getElementById('formMessage');
                messageDiv.className = 'form-message error';
                messageDiv.textContent = 'Erreur de connexion. Veuillez réessayer.';
            }
        });
    }

    const devisForm = document.getElementById('devisForm');
    if (devisForm) {
        devisForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const services = Array.from(document.querySelectorAll('input[name="services[]"]:checked'))
                .map(cb => cb.value);
            
            const formData = {
                nom: document.getElementById('nom').value,
                entreprise: document.getElementById('entreprise').value,
                email: document.getElementById('email').value,
                telephone: document.getElementById('telephone').value,
                secteur: document.getElementById('secteur').value,
                taille: document.getElementById('taille').value,
                services: services,
                urgence: document.getElementById('urgence').value,
                details: document.getElementById('details').value
            };

            try {
                const response = await fetch('/api/devis', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                const messageDiv = document.getElementById('devisMessage');
                
                if (result.success) {
                    messageDiv.className = 'form-message success';
                    messageDiv.textContent = result.message;
                    devisForm.reset();
                } else {
                    messageDiv.className = 'form-message error';
                    messageDiv.textContent = 'Une erreur est survenue. Veuillez réessayer.';
                }
            } catch (error) {
                const messageDiv = document.getElementById('devisMessage');
                messageDiv.className = 'form-message error';
                messageDiv.textContent = 'Erreur de connexion. Veuillez réessayer.';
            }
        });
    }

    const rdvForm = document.getElementById('rdvForm');
    if (rdvForm) {
        rdvForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                nom: document.getElementById('rdvNom').value,
                email: document.getElementById('rdvEmail').value,
                telephone: document.getElementById('rdvTelephone').value,
                entreprise: document.getElementById('rdvEntreprise').value,
                mode: document.getElementById('rdvMode').value,
                date: document.getElementById('rdvDate').value,
                heure: document.getElementById('rdvHeure').value,
                sujet: document.getElementById('rdvSujet').value,
                message: document.getElementById('rdvMessage').value
            };

            try {
                const response = await fetch('/api/rendez-vous', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                const messageDiv = document.getElementById('rdvFormMessage');
                
                if (result.success) {
                    messageDiv.className = 'form-message success';
                    messageDiv.textContent = result.message;
                    rdvForm.reset();
                } else {
                    messageDiv.className = 'form-message error';
                    messageDiv.textContent = 'Une erreur est survenue. Veuillez réessayer.';
                }
            } catch (error) {
                const messageDiv = document.getElementById('rdvFormMessage');
                messageDiv.className = 'form-message error';
                messageDiv.textContent = 'Erreur de connexion. Veuillez réessayer.';
            }
        });
    }

    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                email: document.getElementById('newsletterEmail').value
            };

            try {
                const response = await fetch('/api/newsletter', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                const messageDiv = document.getElementById('newsletterMessage');
                
                if (result.success) {
                    messageDiv.className = 'form-message success';
                    messageDiv.textContent = result.message;
                    newsletterForm.reset();
                } else {
                    messageDiv.className = 'form-message error';
                    messageDiv.textContent = result.message || 'Une erreur est survenue.';
                }
            } catch (error) {
                const messageDiv = document.getElementById('newsletterMessage');
                messageDiv.className = 'form-message error';
                messageDiv.textContent = 'Erreur de connexion. Veuillez réessayer.';
            }
        });
    }

    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const chatMessages = document.getElementById('chatMessages');

    if (chatSend && chatInput) {
        chatSend.addEventListener('click', () => sendMessage());
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    const questionBtns = document.querySelectorAll('.question-btn');
    questionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const question = this.getAttribute('data-question');
            if (chatInput) {
                chatInput.value = question;
                sendMessage();
            }
        });
    });

    async function sendMessage() {
        const message = chatInput.value.trim();
        if (message === '') return;

        addMessage(message, 'user');
        chatInput.value = '';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            const result = await response.json();
            if (result.response) {
                addMessage(result.response, 'bot');
            } else {
                addMessage('Désolé, une erreur est survenue. Veuillez réessayer.', 'bot');
            }
        } catch (error) {
            console.error('Chat error:', error);
            addMessage('Erreur de connexion. Veuillez réessayer.', 'bot');
        }
    }

    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'user-message' : 'bot-message';
        messageDiv.innerHTML = `<p>${text}</p>`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    const subscribeBtns = document.querySelectorAll('.subscribe-btn');
    subscribeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const plan = this.closest('.pricing-card').querySelector('h3').textContent;
            if (plan === 'Entreprise') {
                window.location.href = '/contact';
            } else {
                alert(`Vous avez sélectionné le plan ${plan}. Pour finaliser votre abonnement, veuillez nous contacter.`);
                window.location.href = '/contact';
            }
        });
    });

    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            item.classList.toggle('active');
        });
    });

    const faqCatBtns = document.querySelectorAll('.faq-cat-btn');
    faqCatBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            
            faqCatBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            faqItems.forEach(item => {
                if (category === 'all' || item.getAttribute('data-category') === category) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });

    const blogFilterBtns = document.querySelectorAll('.filter-btn');
    const blogPosts = document.querySelectorAll('.blog-post-card');
    
    blogFilterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            
            blogFilterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            blogPosts.forEach(post => {
                if (filter === 'all' || post.getAttribute('data-category') === filter) {
                    post.style.display = 'block';
                } else {
                    post.style.display = 'none';
                }
            });
        });
    });

    const readMoreBtns = document.querySelectorAll('.read-more-btn');
    readMoreBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const card = this.closest('.blog-post-card');
            card.classList.toggle('expanded');
            
            if (card.classList.contains('expanded')) {
                this.innerHTML = 'Réduire <i class="fas fa-arrow-up"></i>';
            } else {
                this.innerHTML = 'Lire la suite <i class="fas fa-arrow-down"></i>';
            }
        });
    });

    const chatToggle = document.getElementById('chatToggle');
    const chatBox = document.getElementById('chatBox');
    const chatClose = document.getElementById('chatClose');
    const chatWidgetInput = document.getElementById('chatWidgetInput');
    const chatWidgetSend = document.getElementById('chatWidgetSend');
    const chatMessagesWidget = document.getElementById('chatMessagesWidget');

    if (chatToggle) {
        chatToggle.addEventListener('click', () => {
            chatBox.style.display = chatBox.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (chatClose) {
        chatClose.addEventListener('click', () => {
            chatBox.style.display = 'none';
        });
    }

    if (chatWidgetSend && chatWidgetInput) {
        chatWidgetSend.addEventListener('click', () => sendWidgetMessage());
        chatWidgetInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendWidgetMessage();
            }
        });
    }

    async function sendWidgetMessage() {
        const message = chatWidgetInput.value.trim();
        if (message === '') return;

        const userDiv = document.createElement('div');
        userDiv.className = 'user-message';
        userDiv.innerHTML = `<p>${message}</p>`;
        chatMessagesWidget.appendChild(userDiv);
        
        chatWidgetInput.value = '';
        chatMessagesWidget.scrollTop = chatMessagesWidget.scrollHeight;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            const result = await response.json();
            const botDiv = document.createElement('div');
            botDiv.className = 'bot-message';
            botDiv.innerHTML = `<p>${result.response || 'Erreur de réponse'}</p>`;
            chatMessagesWidget.appendChild(botDiv);
            chatMessagesWidget.scrollTop = chatMessagesWidget.scrollHeight;
        } catch (error) {
            console.error('Widget chat error:', error);
            const botDiv = document.createElement('div');
            botDiv.className = 'bot-message';
            botDiv.innerHTML = `<p>Erreur de connexion. Veuillez réessayer.</p>`;
            chatMessagesWidget.appendChild(botDiv);
        }
    }
});
