// ============================================
// CONFIGURAÇÃO SUPABASE
// ============================================
//
// ⚠️ IMPORTANTE: Este arquivo contém credenciais sensíveis!
//
// ✅ SEGURO: A "anon key" (publishable) pode ser pública
// ❌ PERIGOSO: A "secret key" NUNCA deve estar aqui!
//
// Este arquivo deve ser adicionado ao .gitignore
// para não ser commitado no repositório.
//
// ============================================
// 📋 COMO ENCONTRAR A ANON KEY DO SUPABASE:
// ============================================
// 1. Acesse: https://supabase.com/dashboard
// 2. Selecione seu projeto
// 3. Vá em: Settings → API
// 4. Copie a chave "anon public" (começa com "eyJ...")
// 5. Cole abaixo no campo ANON_KEY
//
// ⚠️ A chave deve começar com "eyJ" (é um JWT)
// ❌ NÃO use a chave do PushinPay aqui!
// ============================================

window.SUPABASE_CONFIG = {
    // URL do seu projeto Supabase
    URL: 'https://nmjqfxqbyjssbdkqzkpu.supabase.co',

    // Publishable API Key (anon key) - SEGURA para usar no frontend
    // ✅ Chave configurada corretamente
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tanFmeHFieWpzc2Jka3F6a3B1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MDc2NzMsImV4cCI6MjA4MzQ4MzY3M30.9VPVDpL7DnB51boZ7IhZVE2da_ue9q9FMEs1R2nMxQo',

    // ⚠️ NUNCA coloque a SECRET KEY aqui!
    // A secret key só deve ser usada em Edge Functions (backend)
    // SECRET_KEY: 'sb_secret_...' // ❌ NÃO FAÇA ISSO!
};

// ============================================
// CONFIGURAÇÃO PUSHINPAY
// ============================================
window.PUSHINPAY_CONFIG = {
    // Token da PushinPay
    TOKEN: '41318|bODMbwNQeMxLmie39obUSfBOLQNa8cY0w7C7Agoj499d9c33'
};


