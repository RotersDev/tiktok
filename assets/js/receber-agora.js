// JavaScript para página de Receber Agora

const SUPABASE_URL = window.SUPABASE_CONFIG?.URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG?.ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
}

if (typeof window.receberAgoraSupabase === 'undefined') {
    window.receberAgoraSupabase = null;
}

const EXPRESS_FEE = 28.74; // Taxa para receber agora

let selectedOption = 'express'; // 'express' ou 'wait'
let countdown = 300; // 5 minutos em segundos

// Formatar valor como moeda
function formatCurrency(value) {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).replace('R$', 'R$ ');
}

// Formatar tempo (segundos para MM:SS)
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Obter parâmetros da URL
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        name: params.get('name') || 'Cliente',
        pixKey: params.get('pixKey') || '',
        pixKeyType: params.get('pixKeyType') || 'E-mail',
        amount: parseFloat(params.get('amount')) || 0
    };
}

// Criar pagamento PIX via Supabase
async function createPixPayment(amount, payerName, pixKey, pixKeyType, supabaseClient = null) {
    try {
        const client = supabaseClient || window.receberAgoraSupabase;
        if (!client) {
            throw new Error('Supabase não inicializado');
        }


        const { data, error } = await client.functions.invoke('bright-api', {
            body: {
                amount: amount,
                description: 'Taxa de antecipação de saque',
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
        const client = supabaseClient || window.receberAgoraSupabase;
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
    const client = supabaseClient || window.receberAgoraSupabase;
    if (!client) {
        return;
    }


    let isConfirmed = false;

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
            } else if (statusData) {
            } else {
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
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

// Atualizar seleção de opções
function updateOptionSelection() {
    const expressOption = document.getElementById('expressOption');
    const waitOption = document.getElementById('waitOption');
    const actionBtn = document.getElementById('actionBtn');
    const actionBtnText = document.getElementById('actionBtnText');

    if (selectedOption === 'express') {
        if (expressOption) {
            expressOption.classList.add('selected');
            expressOption.classList.remove('border-border', 'bg-muted');
            expressOption.classList.add('border-primary', 'bg-card');
        }
        if (waitOption) {
            waitOption.classList.remove('selected');
            waitOption.classList.remove('border-primary', 'bg-card');
            waitOption.classList.add('border-border', 'bg-muted');
        }
        if (actionBtn) {
            actionBtn.classList.remove('bg-muted', 'hover:bg-muted/80', 'text-muted-foreground');
            actionBtn.classList.add('bg-primary', 'hover:bg-primary/90', 'text-primary-foreground');
        }
        if (actionBtnText) {
            actionBtnText.textContent = `Quero Receber Agora - ${formatCurrency(EXPRESS_FEE)}`;
        }
    } else {
        if (expressOption) {
            expressOption.classList.remove('selected');
            expressOption.classList.remove('border-primary', 'bg-card');
            expressOption.classList.add('border-border', 'bg-muted');
        }
        if (waitOption) {
            waitOption.classList.add('selected');
            waitOption.classList.remove('border-border', 'bg-muted');
            waitOption.classList.add('border-primary', 'bg-card');
        }
        if (actionBtn) {
            actionBtn.classList.remove('bg-primary', 'hover:bg-primary/90', 'text-primary-foreground');
            actionBtn.classList.add('bg-muted', 'hover:bg-muted/80', 'text-muted-foreground');
        }
        if (actionBtnText) {
            actionBtnText.textContent = 'Aguardar 30 Dias';
        }
    }
}

// Inicializar Supabase
function initSupabase() {
    if (window.supabase && !window.receberAgoraSupabase) {
        try {
            window.receberAgoraSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    storage: localStorage,
                    persistSession: true,
                    autoRefreshToken: true
                }
            });
        } catch (error) {
        }
    }
    return window.receberAgoraSupabase;
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
    const expressFeeEl = document.getElementById('expressFee');
    if (expressFeeEl) {
        expressFeeEl.textContent = formatCurrency(EXPRESS_FEE);
    }

    // Timer countdown
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.textContent = formatTime(countdown);
        const timerInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                timerEl.textContent = formatTime(countdown);
                timerEl.classList.remove('text-destructive');
                timerEl.classList.add('text-primary');
            } else {
                timerEl.textContent = 'expirado';
                timerEl.classList.remove('text-primary');
                timerEl.classList.add('text-destructive');
                clearInterval(timerInterval);
            }
        }, 1000);
    }

    // Event listeners para opções
    const expressOption = document.getElementById('expressOption');
    const waitOption = document.getElementById('waitOption');

    if (expressOption) {
        expressOption.addEventListener('click', () => {
            selectedOption = 'express';
            updateOptionSelection();
        });
    }

    if (waitOption) {
        waitOption.addEventListener('click', () => {
            selectedOption = 'wait';
            updateOptionSelection();
        });
    }

    // Função para processar pagamento PIX
    async function processPixPayment() {
        try {
            showPixLoading();

            const supabaseClient = initSupabase();
            if (!supabaseClient) {
                throw new Error('Supabase não inicializado');
            }

            const paymentData = await createPixPayment(EXPRESS_FEE, params.name, params.pixKey, params.pixKeyType, supabaseClient);

            if (paymentData && paymentData.paymentId) {
                monitorPaymentConfirmation(paymentData.paymentId, (confirmation) => {
                    showPixConfirmed(() => {
                        const nextUrl = `protecao-anti-reversao.html?name=${encodeURIComponent(params.name)}&pixKey=${encodeURIComponent(params.pixKey)}&pixKeyType=${encodeURIComponent(params.pixKeyType)}`;
                        window.location.href = nextUrl;
                    });
                }, supabaseClient);

                showPixModal(paymentData, EXPRESS_FEE);
            } else {
                throw new Error('Resposta inválida da API');
            }
        } catch (error) {
            showPixError(error.message || 'Erro ao processar pagamento. Tente novamente.');
        }
    }

    // Botão de ação
    const actionBtn = document.getElementById('actionBtn');
    if (actionBtn) {
        actionBtn.addEventListener('click', () => {
            if (selectedOption === 'express') {
                processPixPayment();
            } else {
                // Aguardar 30 dias - redirecionar para próxima página
                const nextUrl = `protecao-anti-reversao?name=${encodeURIComponent(params.name)}&pixKey=${encodeURIComponent(params.pixKey)}&pixKeyType=${encodeURIComponent(params.pixKeyType)}`;
                window.location.href = nextUrl;
            }
        });
    }

    // Botão tentar novamente (retry)
    const retryPixBtn = document.getElementById('retryPixBtn');
    if (retryPixBtn) {
        retryPixBtn.addEventListener('click', processPixPayment);
    }

    // Inicializar seleção
    updateOptionSelection();
});

