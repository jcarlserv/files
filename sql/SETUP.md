# Vettore Finances - Configuração Supabase

## Banco de Dados

O banco de dados já está configurado no Supabase. Use o arquivo `schema.sql` enviado anteriormente.

## Credenciais

- **URL:** https://vjdtzesdabmbgnuhcifd.supabase.co
- **Chave Anon:** sb_publishable_GKc2bhpVTzbQdVhJVEQBUw_HE4bxwWD

## Como usar

1. Abrir `index.html` no navegador
2. Auto-login com usuário "Usuário Sistema"
3. Navegar pelas seções: Dashboard, Financeiro, Configuração

## Estrutura

- **unidades** - Franquias/Unidades
- **usuarios** - Usuários do sistema  
- **extratos** - Lançamentos financeiros (com edição)
- **privilegios** - Permissões por perfil

Todos os dados são salvos no Supabase (não em localStorage).
