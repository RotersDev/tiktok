// Remover .html das URLs automaticamente (funciona em qualquer servidor)
// IMPORTANTE: Remove apenas VISUALMENTE após a página carregar, não interfere na navegação
(function() {
    // Função para remover .html da URL atual se necessário (apenas visualmente)
    function removeHtmlExtension() {
        // Verificar se está em um ambiente local (file://) - não fazer nada nesse caso
        if (window.location.protocol === 'file:') {
            return;
        }

        const currentPath = window.location.pathname;

        // Se a URL termina com .html (exceto index.html na raiz), remover visualmente
        if (currentPath.endsWith('.html') && currentPath !== '/index.html' && currentPath !== '/') {
            const newPath = currentPath.replace(/\.html$/, '');
            const newUrl = newPath + window.location.search + window.location.hash;
            // Usar replaceState para não recarregar a página, apenas mudar a URL visualmente
            try {
                window.history.replaceState({}, '', newUrl);
            } catch (e) {
                // Ignorar erros de segurança em ambientes locais
                console.warn('Não foi possível atualizar a URL:', e.message);
            }
        }
    }

    // Executar quando a página carregar COMPLETAMENTE
    // Não interceptar cliques - deixar os links funcionarem normalmente com .html
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Pequeno delay para garantir que a página carregou completamente
            setTimeout(removeHtmlExtension, 100);
        });
    } else {
        setTimeout(removeHtmlExtension, 100);
    }
})();

