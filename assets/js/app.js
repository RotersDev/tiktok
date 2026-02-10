// JavaScript limpo para o projeto TikTok Bônus

// Função de animação de contagem (igual ao original)
function animateCounter(element, targetValue, duration = 2000, delay = 500) {
    let startTime = null;
    let animationFrame = null;
    let isAnimating = false;

    const animate = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function: ease-out (igual ao original)
        const eased = 1 - Math.pow(1 - progress, 4);
        const currentValue = eased * targetValue;

        // Formatar como moeda brasileira
        const formatted = currentValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).replace('R$', 'R$ ');

        element.textContent = formatted;

        if (progress < 1) {
            animationFrame = requestAnimationFrame(animate);
        } else {
            // Garantir valor final exato
            const finalFormatted = targetValue.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).replace('R$', 'R$ ');
            element.textContent = finalFormatted;
            isAnimating = false;
        }
    };

    const start = () => {
        if (!isAnimating) {
            isAnimating = true;
            startTime = null;
            setTimeout(() => {
                animationFrame = requestAnimationFrame(animate);
            }, delay);
        }
    };

    return { start };
}

// Função para abrir o modal de prêmios
function openPrizeModal() {
    const modal = document.getElementById('prizeModal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    }
}

// Função para fechar o modal de prêmios
function closePrizeModal() {
    const modal = document.getElementById('prizeModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
}

// Inicializar animações ao carregar a página
window.addEventListener('load', () => {
    // Animação do saldo (R$ 2.834,72)
    const balanceElement = document.querySelector('.balance-value');
    if (balanceElement) {
        const counter = animateCounter(balanceElement, 2834.72, 2500, 500);
        counter.start();
    }

    // Animação do valor no card de parabéns (R$ 2.834,72)
    const parabensElement = document.querySelector('.parabens-value');
    if (parabensElement) {
        const parabensCounter = animateCounter(parabensElement, 2834.72, 2500, 550);
        parabensCounter.start();
    }

    // Animação do valor no modal (R$ 2.834,72)
    const modalValueElement = document.querySelector('.modal-value');
    if (modalValueElement) {
        const modalCounter = animateCounter(modalValueElement, 2834.72, 1500, 800);
        modalCounter.start();
    }

    // Inicializar timer de expiração
    initExpiryTimer();

    // Abrir modal automaticamente (igual ao original)
    setTimeout(() => {
        openPrizeModal();
    }, 500);
});

// Card de saldo fixo (aparece ao rolar)
function initStickyBalanceCard() {
    const stickyCard = document.getElementById('stickyBalanceCard');
    if (!stickyCard) return;

    let isVisible = false;

    const handleScroll = () => {
        const scrollY = window.scrollY || window.pageYOffset;
        const shouldShow = scrollY > 200;

        if (shouldShow && !isVisible) {
            // Mostrar card
            isVisible = true;
            stickyCard.classList.remove('hidden');
            stickyCard.style.opacity = '0';
            stickyCard.style.transform = 'translateY(100px)';

            setTimeout(() => {
                stickyCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                stickyCard.style.opacity = '1';
                stickyCard.style.transform = 'translateY(0)';
            }, 10);

            // Iniciar animação do valor se ainda não foi iniciada
            const stickyValue = document.querySelector('.sticky-balance-value');
            if (stickyValue && !stickyValue.dataset.animated) {
                stickyValue.dataset.animated = 'true';
                const counter = animateCounter(stickyValue, 2834.72, 2500, 100);
                counter.start();
            }
        } else if (!shouldShow && isVisible) {
            // Esconder card
            isVisible = false;
            stickyCard.style.opacity = '0';
            stickyCard.style.transform = 'translateY(100px)';

            setTimeout(() => {
                stickyCard.classList.add('hidden');
            }, 300);
        }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Verificar estado inicial
}

// Fechar modal ao pressionar ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePrizeModal();
    }
});

// Inicializar card fixo
initStickyBalanceCard();

// Timer de expiração (00:15:00)
function initExpiryTimer() {
    let hours = 0;
    let minutes = 15;
    let seconds = 0;

    const updateTimer = () => {
        // Atualizar timer 1 (card de expiração)
        const hoursEl1 = document.getElementById('expiryHours1');
        const minutesEl1 = document.getElementById('expiryMinutes1');
        const secondsEl1 = document.getElementById('expirySeconds1');

        if (hoursEl1) hoursEl1.textContent = hours.toString().padStart(2, '0');
        if (minutesEl1) minutesEl1.textContent = minutes.toString().padStart(2, '0');
        if (secondsEl1) secondsEl1.textContent = seconds.toString().padStart(2, '0');

        // Atualizar timer 2 (modal)
        const hoursEl2 = document.getElementById('expiryHours2');
        const minutesEl2 = document.getElementById('expiryMinutes2');
        const secondsEl2 = document.getElementById('expirySeconds2');

        if (hoursEl2) hoursEl2.textContent = hours.toString().padStart(2, '0');
        if (minutesEl2) minutesEl2.textContent = minutes.toString().padStart(2, '0');
        if (secondsEl2) secondsEl2.textContent = seconds.toString().padStart(2, '0');

        // Decrementar
        seconds--;
        if (seconds < 0) {
            seconds = 59;
            minutes--;
            if (minutes < 0) {
                minutes = 59;
                hours--;
                if (hours < 0) {
                    hours = 0;
                    minutes = 0;
                    seconds = 0;
                }
            }
        }
    };

    updateTimer(); // Atualizar imediatamente
    setInterval(updateTimer, 1000);
}

